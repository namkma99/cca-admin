import 'server-only';
import { and, asc, count, eq } from 'drizzle-orm';
import { AuthService } from '@/modules/auth/server/service';
import type { AuthDatabase } from '@/modules/auth/server/types';
import { questions } from '@/server/db/schema';
import { AppError } from '@/server/http/errors';
import type {
  ReviewQuestionsResponse,
  ReviewTopicsResponse,
} from '../contracts/dto';

const topics = [
  { id: 'cca-f', name: 'CCA-F' },
  { id: 'ccao-f', name: 'CCAO-F' },
  { id: 'ccar-p', name: 'CCAR-P' },
] as const;

export class ReviewService {
  constructor(private readonly db: AuthDatabase) {}

  async topics(token: string | null): Promise<ReviewTopicsResponse> {
    await new AuthService(this.db).requireSession(token);
    const counts = await this.db
      .select({ topicId: questions.topicCode, total: count() })
      .from(questions)
      .where(eq(questions.status, 'ready'))
      .groupBy(questions.topicCode);
    const byTopic = new Map(counts.map((row) => [row.topicId, row.total]));
    return {
      topics: topics.map((topic) => ({
        ...topic,
        questionCount: byTopic.get(topic.id) ?? 0,
      })),
    };
  }

  async questions(
    token: string | null,
    topicId: string,
  ): Promise<ReviewQuestionsResponse> {
    await new AuthService(this.db).requireSession(token);
    const topic = topics.find((item) => item.id === topicId);
    if (!topic)
      throw new AppError('TOPIC_NOT_FOUND', 404, 'Chủ đề không tồn tại.');
    const rows = await this.db
      .select({
        id: questions.id,
        type: questions.questionType,
        prompt: questions.prompt,
        choices: questions.choices,
        correctChoiceIds: questions.correctChoiceIds,
      })
      .from(questions)
      .where(
        and(eq(questions.topicCode, topic.id), eq(questions.status, 'ready')),
      )
      .orderBy(asc(questions.sourceNumber), asc(questions.id));
    return {
      topicId: topic.id,
      total: rows.length,
      questions: rows.map((row) => {
        // Ready rows are constrained by SQL and validated by the bank importer.
        if (row.type === 'unsupported' || row.prompt === null)
          throw new AppError(
            'INVALID_BANK',
            500,
            'Dữ liệu câu hỏi không hợp lệ.',
          );
        return { ...row, type: row.type, prompt: row.prompt };
      }),
    };
  }
}
