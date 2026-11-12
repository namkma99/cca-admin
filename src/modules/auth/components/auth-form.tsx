'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  setupPasswordSchema,
  sessionResponseSchema,
  loginResponseSchema,
  type LoginInput,
  type SetupPasswordInput,
  type LoginResponse,
} from '../contracts/schemas';
import { authDestination } from '../contracts/navigation';

const inputClass =
  'mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
const fallback = 'Không thể kết nối. Vui lòng thử lại.';

function PasswordField({
  label,
  id,
  registration,
  value,
  onChange,
  error,
  autoComplete,
}: {
  label: string;
  id: string;
  registration?: UseFormRegisterReturn;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  const inputProps = registration ? registration : { value, onChange };
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          {...inputProps}
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          maxLength={128}
          className={`${inputClass} pr-16`}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          className="absolute right-3 top-5 text-sm text-primary focus-visible:outline-2 focus-visible:outline-ring"
        >
          {visible ? 'Ẩn' : 'Hiện'}
        </button>
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="mt-2 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}

async function postLogin(input: LoginInput): Promise<LoginResponse> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = body as { error?: { message?: string } };
    throw new Error(
      typeof error.error?.message === 'string' ? error.error.message : fallback,
    );
  }
  const parsed = loginResponseSchema.safeParse(body);
  if (!parsed.success) throw new Error(fallback);
  return parsed.data;
}

async function postSetup(input: SetupPasswordInput) {
  const response = await fetch('/api/v1/auth/setup-password', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = body as { error?: { message?: string } };
    throw new Error(
      typeof error.error?.message === 'string' ? error.error.message : fallback,
    );
  }
  const parsed = sessionResponseSchema.safeParse(body);
  if (!parsed.success || !parsed.data.session) throw new Error(fallback);
  return parsed.data.session;
}

function FormError({ children }: { children: ReactNode }) {
  return children ? (
    <p
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      {children}
    </p>
  ) : null;
}

function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<'username' | 'password'>('username');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setError('Vui lòng kiểm tra username.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const res = await postLogin({ username: cleanUsername });
      if ('session' in res && res.session) {
        router.replace(authDestination(res.session));
        router.refresh();
      } else if ('needPassword' in res && res.needPassword) {
        setUsername(res.username);
        setStep('password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const res = await postLogin({ username, password });
      if ('session' in res && res.session) {
        router.replace(authDestination(res.session));
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 'password') {
    return (
      <form
        onSubmit={handlePasswordSubmit}
        noValidate
        className="space-y-5"
        aria-busy={isSubmitting}
      >
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <span className="font-medium text-foreground">{username}</span>
          <button
            type="button"
            onClick={() => {
              setStep('username');
              setPassword('');
              setError('');
            }}
            className="text-xs font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Thay đổi
          </button>
        </div>
        <PasswordField
          id="password"
          label="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <FormError>{error}</FormError>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleUsernameSubmit}
      noValidate
      className="space-y-5"
      aria-busy={isSubmitting}
    >
      <div>
        <label htmlFor="username" className="text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={64}
          autoFocus
          className={inputClass}
          aria-invalid={!!error && !username.trim()}
          aria-describedby={error ? 'username-error' : undefined}
        />
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Đang kiểm tra…' : 'Tiếp tục'}
      </Button>
    </form>
  );
}

function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupPasswordInput>({
    resolver: zodResolver(setupPasswordSchema),
  });
  const submit = handleSubmit(async (input) => {
    setError('');
    try {
      const session = await postSetup(input);
      router.replace(authDestination(session));
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : fallback);
    }
  });
  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-5"
      aria-busy={isSubmitting}
    >
      <PasswordField
        id="new-password"
        label="Mật khẩu mới"
        registration={register('password')}
        autoComplete="new-password"
        error={errors.password?.message}
      />
      <PasswordField
        id="confirm-password"
        label="Xác nhận mật khẩu"
        registration={register('confirmPassword')}
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
      />
      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Đang lưu…' : 'Đặt mật khẩu'}
      </Button>
    </form>
  );
}
export function AuthForm({ mode }: { mode: 'login' | 'setup' }) {
  return mode === 'login' ? <LoginForm /> : <SetupForm />;
}
