import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { timestamps } from './common';

export type QuestionChoice = { id: string; text: string };
export type QuestionSnapshot = {
  id: string;
  questionType: 'single_choice' | 'multiple_response';
  prompt: string;
  choices: QuestionChoice[];
  correctChoiceIds: string[];
};

// These are basic SQL shape checks. Importer/service must also validate unique choice
// IDs, nonempty choice text and membership/uniqueness of correctChoiceIds.
export const questions = pgTable(
  'questions',
  {
    id: text('id').primaryKey(),
    topicCode: text('topic_code', {
      enum: ['cca-f', 'ccao-f', 'ccar-p'],
    }).notNull(),
    questionType: text('question_type', {
      enum: ['single_choice', 'multiple_response', 'unsupported'],
    }).notNull(),
    prompt: text('prompt'),
    choices: jsonb('choices').$type<QuestionChoice[]>().default([]).notNull(),
    correctChoiceIds: text('correct_choice_ids')
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    status: text('status', { enum: ['ready', 'needs_review', 'disabled'] })
      .default('needs_review')
      .notNull(),
    sourceNumber: integer('source_number').notNull(),
    ...timestamps(),
  },
  (t) => [
    unique('questions_source_unique').on(t.topicCode, t.sourceNumber),
    index('questions_topic_status_idx').on(t.topicCode, t.status),
    check(
      'questions_topic_valid',
      sql`${t.topicCode} IN ('cca-f', 'ccao-f', 'ccar-p')`,
    ),
    check(
      'questions_type_valid',
      sql`${t.questionType} IN ('single_choice', 'multiple_response', 'unsupported')`,
    ),
    check(
      'questions_status_valid',
      sql`${t.status} IN ('ready', 'needs_review', 'disabled')`,
    ),
    check('questions_source_positive', sql`${t.sourceNumber} > 0`),
    check('questions_choices_array', sql`jsonb_typeof(${t.choices}) = 'array'`),
    check(
      'questions_ready_structure',
      sql`${t.status} <> 'ready' OR (
    ${t.prompt} IS NOT NULL AND length(btrim(${t.prompt})) > 0
    AND CASE WHEN jsonb_typeof(${t.choices}) = 'array' THEN jsonb_array_length(${t.choices}) >= 2 ELSE false END
    AND ((${t.questionType} = 'single_choice' AND cardinality(${t.correctChoiceIds}) = 1)
      OR (${t.questionType} = 'multiple_response' AND cardinality(${t.correctChoiceIds}) >= 2))
  )`,
    ),
  ],
);
