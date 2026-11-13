'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AdminFeedback } from '@/components/ui/admin-feedback';
import { adminRequest, errorMessage } from '@/shared/utils/admin-request';
import type { AppSettings } from '../contracts/schemas';

const inputClass =
  'mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

const sessionFields = [
  {
    key: 'sessionDurationMinutes',
    label: 'Thời hạn phiên đăng nhập (phút)',
    max: 43200,
  },
  {
    key: 'passwordSetupDurationMinutes',
    label: 'Thời hạn phiên đặt mật khẩu (phút)',
    max: 60,
  },
] as const;
const rateLimitFields = [
  {
    key: 'windowMinutes',
    label: 'Khoảng thời gian giới hạn đăng nhập (phút)',
    max: 1440,
  },
  {
    key: 'maxAttemptsPerUsername',
    label: 'Số lần đăng nhập tối đa / tài khoản',
    max: 10000,
  },
  {
    key: 'maxAttemptsPerIp',
    label: 'Số lần đăng nhập tối đa / IP',
    max: 10000,
  },
] as const;

export function SettingsPanel({
  initialSettings,
}: {
  initialSettings: AppSettings;
}) {
  const [form, setForm] = useState<AppSettings>(initialSettings);
  const [saved, setSaved] = useState(initialSettings);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting || !dirty) return;
    setMessage('');
    setError('');
    setIsSubmitting(true);

    try {
      const data = await adminRequest<{ settings: AppSettings }>(
        '/api/v1/admin/settings',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      setSaved(data.settings);
      setForm(data.settings);
      setMessage('Đã lưu cấu hình hệ thống thành công!');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Cài đặt hệ thống
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý cấu hình kỳ thi, xác thực và thông số hệ thống CCA.
          </p>
        </div>
      </div>

      <AdminFeedback success={message} />
      <AdminFeedback error={error} />

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
        aria-busy={isSubmitting}
      >
        <fieldset disabled={isSubmitting} className="space-y-6">
          {/* Card 1: Exam Settings */}
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-5">
            <h2 className="text-base font-semibold">Cấu hình bài thi</h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="duration" className="text-sm font-medium">
                  Thời gian làm bài thi (phút)
                </label>
                <input
                  id="duration"
                  type="number"
                  min={10}
                  max={300}
                  required
                  value={form.examDurationMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      examDurationMinutes: Number(e.target.value),
                    })
                  }
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Thời gian làm bài thi đếm ngược (mặc định: 120 phút).
                </p>
              </div>

              <div>
                <label htmlFor="formCount" className="text-sm font-medium">
                  Số lượng đề thi trong chu kỳ
                </label>
                <input
                  id="formCount"
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={form.formCount}
                  onChange={(e) =>
                    setForm({ ...form, formCount: Number(e.target.value) })
                  }
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Số lượng đề thi ngẫu nhiên phát cho học viên trong 1 chu kỳ
                  (mặc định: 10).
                </p>
              </div>

              <div>
                <label htmlFor="passingScore" className="text-sm font-medium">
                  Điểm đạt chuẩn (%)
                </label>
                <input
                  id="passingScore"
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={form.passingScorePercentage}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      passingScorePercentage: Number(e.target.value),
                    })
                  }
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Tỷ lệ phần trăm điểm tối thiểu để được tính là Đạt (Pass).
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: General Settings */}
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-5">
            <h2 className="text-base font-semibold">Cấu hình chung</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="systemName" className="text-sm font-medium">
                  Tên hệ thống / Tiêu đề kỳ thi
                </label>
                <input
                  id="systemName"
                  type="text"
                  maxLength={100}
                  required
                  value={form.systemName}
                  onChange={(e) =>
                    setForm({ ...form, systemName: e.target.value })
                  }
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Hiển thị trên giao diện làm bài thi và trang tài khoản học
                  viên.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  id="allowReview"
                  type="checkbox"
                  checked={form.allowReviewAnswers}
                  onChange={(e) =>
                    setForm({ ...form, allowReviewAnswers: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                />
                <label htmlFor="allowReview" className="text-sm font-medium">
                  Cho phép học viên xem lại đáp án sau khi nộp bài
                </label>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-5">
            <h2 className="text-base font-semibold">
              Xác thực & phiên đăng nhập
            </h2>
            <p className="text-sm text-muted-foreground">
              Thời hạn mới áp dụng cho phiên được cấp sau khi lưu. Phiên đang
              tồn tại giữ nguyên ngày hết hạn.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              {sessionFields.map(({ key, label, max }) => (
                <div key={key}>
                  <label htmlFor={key} className="text-sm font-medium">
                    {label}
                  </label>
                  <input
                    id={key}
                    type="number"
                    min={1}
                    max={max}
                    step={1}
                    required
                    value={form.auth[key]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        auth: { ...form.auth, [key]: Number(e.target.value) },
                      })
                    }
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Từ 1 đến {max} phút.
                  </p>
                </div>
              ))}
              {rateLimitFields.map(({ key, label, max }) => (
                <div key={key}>
                  <label htmlFor={key} className="text-sm font-medium">
                    {label}
                  </label>
                  <input
                    id={key}
                    type="number"
                    min={1}
                    max={max}
                    step={1}
                    required
                    value={form.auth.loginRateLimit[key]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        auth: {
                          ...form.auth,
                          loginRateLimit: {
                            ...form.auth.loginRateLimit,
                            [key]: Number(e.target.value),
                          },
                        },
                      })
                    }
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Giá trị nguyên từ 1 đến {max}.
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Giới hạn tính cả đăng nhập thành công và thất bại. Thay đổi không
              xóa bộ đếm hiện tại; khoảng thời gian mới áp dụng khi bộ đếm bắt
              đầu chu kỳ tiếp theo.
            </p>
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">
            {dirty ? 'Bạn có thay đổi chưa lưu.' : 'Cấu hình đã được đồng bộ.'}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || !dirty}
              onClick={() => {
                setForm(saved);
                setMessage('');
                setError('');
              }}
            >
              Hủy thay đổi
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !dirty}
              className="min-w-32"
            >
              {isSubmitting ? 'Đang lưu…' : 'Lưu cài đặt'}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
