import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { api } from '../../lib/api';
import { registerSchema, userSchema } from './contracts';
import { AuthPanel, Field, FormError, Submit } from './FormParts';

export function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });
  async function submit(values: z.infer<typeof registerSchema>) {
    try {
      await api('/auth/register', userSchema, {
        body: {
          username: values.username,
          email: values.email,
          password: values.password,
        },
      });
      navigate('/login', {
        replace: true,
        state: { registered: true, email: values.email },
      });
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  }
  return (
    <AuthPanel
      path="new_user"
      index="02 / GET STARTED"
      title="Make yourself at home."
      description="A few details, and a fresh start."
    >
      <form noValidate onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}>
        <Field
          label="Username"
          autoComplete="username"
          placeholder="Your little alias"
          maxLength={50}
          registration={register('username')}
          error={errors.username?.message}
          hint="3–50 characters. Make it yours."
        />
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          maxLength={128}
          registration={register('password')}
          error={errors.password?.message}
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
        <Submit busy={isSubmitting}>Make it mine</Submit>
      </form>
      <p className="auth-switch">
        Already have a little corner?{' '}
        <Link to="/login">
          Sign in <span aria-hidden="true">↗</span>
        </Link>
      </p>
    </AuthPanel>
  );
}
