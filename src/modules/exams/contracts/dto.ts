export type TopicId = 'cca-f' | 'ccao-f' | 'ccar-p';
export type QuestionType = 'single_choice' | 'multiple_response';
export type Choice = { id: string; text: string };
export type Question = {
  id: string;
  type: QuestionType;
  prompt: string;
  choices: Choice[];
  requiredSelectionCount: number;
};
export type Attempt = {
  id: string;
  topicId: TopicId;
  formNumber: number;
  status: 'in_progress';
  startedAt: number;
  expiresAt: number;
  serverNow: number;
  questions: Question[];
};
export type Summary = {
  id: string;
  topicId: TopicId;
  formNumber: number;
  status: 'submitted' | 'abandoned' | 'timed_out';
  startedAt: number;
  endedAt: number;
  finalizedAt: number;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  simulatedScore: number;
  percent: number;
  reason: 'timeout' | 'abandoned' | 'submitted';
};
export type CatalogTopic = {
  id: TopicId;
  title: string;
  questionCount: number;
  excludedCount: number;
  questionsPerExam: number;
  durationMinutes: number;
  formCount: number;
  total?: number;
  forms: number;
  usedForms: number[];
  availableForms: number[];
};
export type Catalog = { topics: CatalogTopic[] };
export type Dashboard = {
  results: Summary[];
  cycles: {
    topicId: TopicId;
    usedForms: number[];
    activeAttemptId: string | null;
  }[];
  activeAttemptId: string | null;
};
