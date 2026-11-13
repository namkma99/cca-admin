'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { requestJson } from '@/shared/http/request-json';
import type { AppSettings } from '../contracts/schemas';

const inputClass =
  'mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
          <Link
            href="/admin"
            className="text-sm text-muted-foreground underline"
          >
            ← Admin overview
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">System settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage CCA exam configuration and system preferences.
          </p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <fieldset disabled={isSubmitting} className="space-y-6">
          {/* Card 1: Exam Settings */}
          <div className="rounded-xl border border-border bg-background p-6 shadow-xs space-y-5">
            <h2 className="text-xl font-semibold">Exam settings</h2>

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
                  Number of exam forms per topic in each cycle. Range: 1–50.
                  Default: 10.
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
          <div className="rounded-xl border border-border bg-background p-6 shadow-xs space-y-5">
            <h2 className="text-xl font-semibold">General settings</h2>

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
                Answer review is a stored preference. The current exam API does
                not provide answer review.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-muted-foreground">
              {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
            </p>
            <div className="flex gap-3">
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
        </fieldset>
      </form>
    </section>
  );
}
