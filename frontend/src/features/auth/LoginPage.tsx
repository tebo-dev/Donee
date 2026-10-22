import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { api } from '../../lib/api';
import { loginSchema, tokenSchema } from './contracts';
import { useAuth } from './auth-context';
import { AuthPanel, Field, FormError, Submit } from './FormParts';

export function LoginPage() {
  const { authenticate, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    registered?: boolean;
    passwordReset?: boolean;
    email?: string;
  } | null;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: state?.email || '', password: '' },
  });
  async function submit(values: z.infer<typeof loginSchema>) {
    try {
      const result = await api('/auth/login', tokenSchema, { body: values });
      await authenticate(result);
      navigate('/workspaces', { replace: true });
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  }
  return (
    <AuthPanel
      path="welcome_back"
      index="01 / SIGN IN"
      title="Welcome back, human."
      description="Your little corner is right where you left it."
    >
      {notice && (
        <p className="form-message" role="status">
          {notice}
        </p>
      )}
      {state?.registered && (
        <p className="form-message" role="status">
          Your account is ready. Sign in to make yourself at home.
        </p>
      )}
      {state?.passwordReset && (
        <p className="form-message" role="status">
          Your password has been changed. Sign in with your new password.
        </p>
      )}
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
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your secret goes here"
          maxLength={128}
          registration={register('password')}
          error={errors.password?.message}
        />
        <div className="form-options">
          <span>Good to have you here.</span>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <FormError message={errors.root?.message} />
        <Submit busy={isSubmitting}>Let me in</Submit>
      </form>
      <p className="auth-switch">
        New around here?{' '}
        <Link to="/register">
          Create an account <span aria-hidden="true">↗</span>
        </Link>
      </p>
      <p className="form-footnote">
        A little less to remember. A little more room to think.
      </p>
    </AuthPanel>
  );
}
