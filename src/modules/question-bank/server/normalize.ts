import type { QuestionChoice } from '@/server/db/schema/questions';
import { AppError } from '@/server/http/errors';

export type CanonicalQuestion = {
  id: string;
  topicCode: 'cca-f' | 'ccao-f' | 'ccar-p';
  questionType: 'single_choice' | 'multiple_response' | 'unsupported';
  prompt: string | null;
  choices: QuestionChoice[];
  correctChoiceIds: string[];
  status: 'ready' | 'needs_review' | 'disabled';
  sourceNumber: number;
};

const topics = new Set(['cca-f', 'ccao-f', 'ccar-p']);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' ? v : null);
const fail = (message: string): never => {
  throw new AppError('INVALID_BANK', 422, message);
};

function normalizeChoices(value: unknown): {
  choices: QuestionChoice[];
  malformed: boolean;
} {
  if (!Array.isArray(value)) return { choices: [], malformed: true };
  const malformed = value.some(
    (item) =>
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.text !== 'string',
  );
  const choices = value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.text !== 'string'
    )
      return [];
    return [{ id: item.id.trim(), text: item.text.trim() }];
  });
  return { choices, malformed };
}

export function normalizeBank(input: unknown): CanonicalQuestion[] {
  if (!isRecord(input) || !Array.isArray(input.topics))
    fail('Bank must contain a topics array.');
  const root = input as Record<string, unknown>;
  if (root.schemaVersion !== 1) fail('Bank schemaVersion is invalid.');
  const topicList = root.topics as unknown[];
  if (topicList.length === 0) fail('Bank must contain at least one topic.');
  const rows: CanonicalQuestion[] = [];
  const ids = new Set<string>();
  const sources = new Set<string>();
  const topicIds = new Set<string>();
  for (const topic of topicList) {
    if (
      !isRecord(topic) ||
      typeof topic.id !== 'string' ||
      !topics.has(topic.id) ||
      !Array.isArray(topic.questions)
    )
      fail('Bank contains an invalid topic.');
    const topicRecord = topic as Record<string, unknown>;
    const topicCode = topicRecord.id as CanonicalQuestion['topicCode'];
    if (topicIds.has(topicCode)) fail('Bank topics must be unique.');
    topicIds.add(topicCode);
    if ((topicRecord.questions as unknown[]).length === 0)
      fail('Bank topics must contain questions.');
    if (
      topicRecord.questionCount !== undefined &&
      topicRecord.questionCount !== (topicRecord.questions as unknown[]).length
    )
      fail('Topic questionCount does not match its questions.');
    if (
      topicRecord.readyQuestionCount !== undefined &&
      topicRecord.readyQuestionCount !==
        (topicRecord.questions as unknown[]).filter(
          (item) => isRecord(item) && item.status === 'ready',
        ).length
    )
      fail('Topic readyQuestionCount does not match its questions.');
    for (const raw of topicRecord.questions as unknown[]) {
      if (
        !isRecord(raw) ||
        typeof raw.id !== 'string' ||
        !isRecord(raw.source) ||
        !Number.isInteger(raw.source.number) ||
        (raw.source.number as number) <= 0
      )
        fail('Question metadata is invalid.');
      const rawRecord = raw as Record<string, unknown>;
      const source = rawRecord.source as Record<string, unknown>;
      const id = (rawRecord.id as string).trim();
      if (!id || ids.has(id)) fail('Question IDs must be unique.');
      const sourceNumber = source.number as number;
      const sourceKey = `${topicCode}:${sourceNumber}`;
      if (sources.has(sourceKey))
        fail('Question source numbers must be unique per topic.');
      ids.add(id);
      sources.add(sourceKey);
      const rawType =
        typeof rawRecord.type === 'string' ? rawRecord.type : 'unsupported';
      const supported =
        rawType === 'single_choice' || rawType === 'multiple_response';
      const questionType = supported ? rawType : 'unsupported';
      const normalizedChoices = normalizeChoices(rawRecord.choices);
      const choices = normalizedChoices.choices;
      const rawCorrect = Array.isArray(rawRecord.correctChoiceIds)
        ? (rawRecord.correctChoiceIds as unknown[])
        : [];
      const malformedCorrectType = !Array.isArray(rawRecord.correctChoiceIds);
      const correctChoiceIds = rawCorrect
        .filter((v: unknown): v is string => typeof v === 'string')
        .map((v: string) => v.trim());
      const promptValue = text(rawRecord.prompt);
      const statusValue =
        rawRecord.status === 'disabled'
          ? 'disabled'
          : rawRecord.status === 'ready'
            ? 'ready'
            : 'needs_review';
      const malformedChoices =
        choices.length < 2 ||
        new Set(choices.map((c) => c.id)).size !== choices.length ||
        choices.some((c) => !c.id || !c.text);
      const malformedAnswers =
        malformedCorrectType ||
        rawCorrect.some((value) => typeof value !== 'string') ||
        new Set(correctChoiceIds).size !== correctChoiceIds.length ||
        correctChoiceIds.some(
          (id: string) => !choices.some((c) => c.id === id),
        ) ||
        (questionType === 'single_choice'
          ? correctChoiceIds.length !== 1
          : questionType === 'multiple_response' &&
            correctChoiceIds.length < 2);
      if (
        statusValue === 'ready' &&
        supported &&
        (!promptValue?.trim() ||
          normalizedChoices.malformed ||
          malformedChoices ||
          malformedAnswers)
      )
        fail(`Ready question ${id} is malformed.`);
      rows.push({
        id,
        topicCode,
        questionType,
        prompt: promptValue,
        choices,
        correctChoiceIds,
        status: supported ? statusValue : 'needs_review',
        sourceNumber,
      });
    }
  }
  return rows;
}
