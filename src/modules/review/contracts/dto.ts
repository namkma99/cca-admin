import type {
  Choice,
  QuestionType,
  TopicId,
} from '@/modules/exams/contracts/dto';

export type QuestionKeywordMapping = {
  choiceId: string;
  questionKeywords: string[];
  answerKeyword: string;
  choiceTextVi: string;
  whyVi: string;
};

export type QuestionStudyGuide = {
  promptVi: string;
  choicesVi: Choice[];
  questionKeywords: string[];
  answerKeywords: string[];
  quickFormulaVi?: string;
  keywordMappings?: QuestionKeywordMapping[];
  explanationVi: string;
};

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
  studyGuide?: QuestionStudyGuide;
};

export type ReviewTopicsResponse = { topics: ReviewTopic[] };
export type ReviewQuestionsResponse = {
  topicId: TopicId;
  total: number;
  questions: ReviewQuestion[];
};
