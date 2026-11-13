'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AdminFeedback } from '@/components/ui/admin-feedback';
import { requestJson } from '@/shared/http/request-json';
import type { AppSettings } from '../contracts/schemas';

const inputClass =
  'mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

const sessionFields = [
  {
    key: 'sessionDurationMinutes',
    label: 'Session duration (minutes)',
    max: 43200,
  },
  {
    key: 'passwordSetupDurationMinutes',
    label: 'Password setup session duration (minutes)',
    max: 60,
  },
] as const;
const rateLimitFields = [
  {
    key: 'windowMinutes',
    label: 'Sign-in rate limit window (minutes)',
    max: 1440,
  },
  {
    key: 'maxAttemptsPerUsername',
    label: 'Maximum sign-in attempts per account',
    max: 10000,
  },
  {
    key: 'maxAttemptsPerIp',
    label: 'Maximum sign-in attempts per IP',
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
  const busy = useRef(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy.current || !dirty) return;
    busy.current = true;
    setMessage('');
    setError('');
    setIsSubmitting(true);

    try {
      const data = await requestJson<{ settings: AppSettings }>(
        '/api/v1/admin/settings',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      setSaved(data.settings);
      setForm(data.settings);
      setMessage('Settings saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      busy.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            System settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage exam configuration, authentication and system preferences.
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
            <h2 className="text-base font-semibold">Exam settings</h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="duration" className="text-sm font-medium">
                  Exam duration (minutes)
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
                  Time allowed for each exam. Range: 10–300 minutes. Default:
                  120.
                </p>
              </div>

              <div>
                <label htmlFor="formCount" className="text-sm font-medium">
                  Forms per cycle
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
                  Number of forms per topic in each cycle. Range: 1–50. Default:
                  10.
                </p>
              </div>

              <div>
                <label htmlFor="passingScore" className="text-sm font-medium">
                  Passing score (%)
                </label>
                <input
                  id="passingScore"
                  type="number"
                  step="any"
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
                  Stored preference, from 0 to 100%. The current exam service
                  does not apply this threshold.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: General Settings */}
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-5">
            <h2 className="text-base font-semibold">General settings</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="systemName" className="text-sm font-medium">
                  System name
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
                  Stored portal name, up to 100 characters. Student pages
                  currently use the CCA name.
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
                  Allow students to review answers after submission
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Answer review after exam submission is a stored preference. The
                separate Review API does not use this setting.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-5">
            <h2 className="text-base font-semibold">
              Authentication and sessions
            </h2>
            <p className="text-sm text-muted-foreground">
              New durations apply to sessions issued after saving. Existing
              sessions keep their expiry time.
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
                    From 1 to {max} minutes.
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
                    Whole numbers from 1 to {max}.
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Limits count both successful and failed sign-ins. Saving does not
              reset existing counters. A new window duration applies to the next
              counter cycle.
            </p>
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">
            {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
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
              Discard changes
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !dirty}
              className="min-w-32"
            >
              {isSubmitting ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
