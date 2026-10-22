import { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { api, ApiError } from '../../lib/api';
import {
  forgotSchema,
  verifySchema,
  resetSchema,
  messageSchema,
  tokenSchema,
} from './contracts';
import { useAuth } from './auth-context';
import { AuthPanel, Field, FormError, Submit } from './FormParts';

type Challenge = { email: string; code: string; resendAt: number };
type Recovery = { challenge: Challenge; update: (value: Challenge) => void };
function nextResendAt() {
  return Date.now() + 60_000;
}
export function RecoveryFlow() {
  const [challenge, update] = useState<Challenge>({
    email: '',
    code: '',
    resendAt: 0,
  });
  return <Outlet context={{ challenge, update } satisfies Recovery} />;
}

export function ForgotPasswordPage() {
  const { challenge, update } = useOutletContext<Recovery>();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: challenge.email },
  });
  async function submit(values: z.infer<typeof forgotSchema>) {
    try {
      await api('/auth/forgot-password', messageSchema, { body: values });
      update({ email: values.email, code: '', resendAt: nextResendAt() });
      navigate('/verify-reset-code');
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  }
  return (
    <AuthPanel
      path="find_your_way_back"
      index="03 / RECOVER · 1 OF 3"
      title="Lost the key?"
      description="It happens. Let's get you back to your little corner."
    >
      <form noValidate onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}>
        <Field
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@somewhere.com"
          maxLength={320}
          registration={register('email')}
          error={errors.email?.message}
        />
        <FormError message={errors.root?.message} />
        <Submit busy={isSubmitting}>Send a reset code</Submit>
      </form>
      <p className="auth-switch">
        Found it?{' '}
        <Link to="/login">
          Back to sign in <span aria-hidden="true">↗</span>
        </Link>
      </p>
      <p className="form-footnote">
        If an account exists for that email, we'll send a six-digit code. It
        expires after 10 minutes.
      </p>
    </AuthPanel>
  );
}

export function VerifyCodePage() {
  const recovery = useOutletContext<Recovery>();
  if (!recovery.challenge.email)
    return <Navigate to="/forgot-password" replace />;
  return <VerifyCodeForm {...recovery} />;
}

function VerifyCodeForm({ challenge, update }: Recovery) {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const remaining = Math.max(0, Math.ceil((challenge.resendAt - now) / 1000));
  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { email: challenge.email, code: '' },
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function submit(values: z.infer<typeof verifySchema>) {
    if (sending) return;
    try {
      await api('/auth/verify-reset-code', messageSchema, { body: values });
      update({ ...challenge, code: values.code });
      navigate('/reset-password');
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  }
  async function resend() {
    if (sending || isSubmitting || remaining) return;
    setSending(true);
    setResendError('');
    setMessage('');
    try {
      await api('/auth/forgot-password', messageSchema, {
        body: { email: challenge.email },
      });
      update({ ...challenge, code: '', resendAt: Date.now() + 60_000 });
      resetField('code');
      setMessage(
        'If the account exists, a fresh code is on its way. Use the newest email.',
      );
    } catch (error) {
      setResendError(
        error instanceof Error ? error.message : 'Please try again.',
      );
      if (error instanceof ApiError && error.retryAfter)
        update({
          ...challenge,
          resendAt: Date.now() + error.retryAfter * 1000,
        });
    } finally {
      setSending(false);
      setNow(Date.now());
    }
  }
  return (
    <AuthPanel
      path="check_your_inbox"
      index="03 / RECOVER · 2 OF 3"
      title="A little inbox detour."
      description={
        <>
          If an account exists for <strong>{challenge.email}</strong>, a reset
          code is on its way.
        </>
      }
    >
      <form
        noValidate
        onSubmit={handleSubmit(submit)}
        aria-busy={isSubmitting || sending}
      >
        <Field
          label="Reset code"
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="000000"
          maxLength={6}
          className="code-input"
          registration={register('code')}
          error={errors.code?.message}
          hint="Six digits. Check your spam folder, too."
        />
        <FormError message={errors.root?.message} />
        <Submit busy={isSubmitting || sending}>Verify code</Submit>
      </form>
      <div className="resend-row">
        <span>Nothing in your inbox?</span>
        <button
          className="text-button"
          onClick={() => {
            void resend();
          }}
          disabled={sending || isSubmitting || remaining > 0}
        >
          {sending
            ? 'Sending…'
            : remaining > 0
              ? `Resend in ${remaining}s`
              : 'Send a new code'}
        </button>
      </div>
      <FormError message={resendError} />
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      <p className="auth-switch">
        <Link to="/forgot-password">Use a different email</Link>
        <span aria-hidden="true"> / </span>
        <Link to="/login">Back to sign in</Link>
      </p>
      <p className="form-footnote">
        Keep this tab open while you recover your account. Reloading starts a
        new recovery flow.
      </p>
    </AuthPanel>
  );
}

export function ResetPasswordPage() {
  const recovery = useOutletContext<Recovery>();
  if (!recovery.challenge.email)
    return <Navigate to="/forgot-password" replace />;
  if (!recovery.challenge.code)
    return <Navigate to="/verify-reset-code" replace />;
  return <ResetPasswordForm {...recovery} />;
}

function ResetPasswordForm({ challenge }: Recovery) {
  const { authenticate } = useAuth();
  const navigate = useNavigate();
  const [passwordChanged, setPasswordChanged] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
  });
  async function submit(values: z.infer<typeof resetSchema>) {
    try {
      const result = await api('/auth/reset-password', tokenSchema, {
        body: {
          email: challenge.email,
          code: challenge.code,
          new_password: values.new_password,
        },
      });
      // Reset codes are single-use: profile loading failure must lead to sign-in rather than resubmitting the consumed code.
      setPasswordChanged(true);
      try {
        await authenticate(result);
        navigate('/account', { replace: true, state: { passwordReset: true } });
      } catch {
        navigate('/login', {
          replace: true,
          state: { email: challenge.email, passwordReset: true },
        });
      }
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  }
  return (
    <AuthPanel
      path="a_fresh_key"
      index="03 / RECOVER · 3 OF 3"
      title="A fresh key. Same you."
      description="Choose a new password for your little corner."
    >
      <form noValidate onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}>
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          maxLength={128}
          registration={register('new_password')}
          error={errors.new_password?.message}
          hint="8–128 characters."
        />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="One more time"
          maxLength={128}
          registration={register('confirm')}
          error={errors.confirm?.message}
        />
        <FormError message={errors.root?.message} />
        <Submit busy={isSubmitting || passwordChanged}>
          Save my new password
        </Submit>
      </form>
      <p className="auth-switch">
        <Link to="/verify-reset-code">Need a fresh code?</Link>
      </p>
      <p className="form-footnote">
        Changing your password also invalidates your older sign-in sessions.
      </p>
    </AuthPanel>
  );
}
