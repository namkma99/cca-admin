import type {
  Choice,
  QuestionType,
  TopicId,
} from '@/modules/exams/contracts/dto';

export type ReviewTopic = {
  id: TopicId;
  name: string;
  questionCount: number;
};

export type ReviewQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  choices: Choice[];
  correctChoiceIds: string[];
};

export type ReviewTopicsResponse = { topics: ReviewTopic[] };
export type ReviewQuestionsResponse = {
  topicId: TopicId;
  total: number;
  questions: ReviewQuestion[];
};
