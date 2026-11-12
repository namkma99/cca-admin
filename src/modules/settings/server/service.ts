import 'server-only';
import { settings } from '@/server/db/schema';
import type { AuthDatabase } from '@/modules/auth/server/types';
import {
  appSettingsSchema,
  updateSettingsSchema,
  type AppSettings,
} from '../contracts/schemas';
import { AppError } from '@/server/http/errors';

export class SettingsService {
  constructor(private readonly db: AuthDatabase) {}

  async getAll(): Promise<AppSettings> {
    const rows = await this.db.select().from(settings);
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return appSettingsSchema.parse({
      examDurationMinutes: map.get('exam_duration_minutes'),
      formCount: map.get('form_count'),
      passingScorePercentage: map.get('passing_score_percentage'),
      systemName: map.get('system_name'),
      allowReviewAnswers: map.get('allow_review_answers'),
    });
  }

  async update(actorUserId: string, input: unknown): Promise<AppSettings> {
    const parsed = updateSettingsSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(
        'INVALID_INPUT',
        400,
        'Dữ liệu cấu hình không hợp lệ.',
      );
    }
    const data = parsed.data;
    const now = new Date();

    const updates: Array<{ key: string; value: unknown; description: string }> =
      [];
    if (data.examDurationMinutes !== undefined) {
      updates.push({
        key: 'exam_duration_minutes',
        value: data.examDurationMinutes,
        description: 'Thời gian làm bài thi (phút)',
      });
    }
    if (data.formCount !== undefined) {
      updates.push({
        key: 'form_count',
        value: data.formCount,
        description: 'Số lượng đề thi ngẫu nhiên cho mỗi chủ đề',
      });
    }
    if (data.passingScorePercentage !== undefined) {
      updates.push({
        key: 'passing_score_percentage',
        value: data.passingScorePercentage,
        description: 'Tỷ lệ điểm để đạt bài thi (%)',
      });
    }
    if (data.systemName !== undefined) {
      updates.push({
        key: 'system_name',
        value: data.systemName,
        description: 'Tên cổng thi hiển thị cho học viên',
      });
    }
    if (data.allowReviewAnswers !== undefined) {
      updates.push({
        key: 'allow_review_answers',
        value: data.allowReviewAnswers,
        description: 'Cho phép học viên xem lại đáp án sau khi nộp bài',
      });
    }

    await this.db.transaction(async (tx) => {
      for (const item of updates) {
        await tx
          .insert(settings)
          .values({
            key: item.key,
            value: item.value,
            description: item.description,
            updatedBy: actorUserId,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: settings.key,
            set: {
              value: item.value,
              description: item.description,
              updatedBy: actorUserId,
              updatedAt: now,
            },
          });
      }
    });

    return this.getAll();
  }
}
