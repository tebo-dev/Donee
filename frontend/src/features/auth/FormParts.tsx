import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Eye, EyeSlash, ArrowRight } from '@phosphor-icons/react';
import type { UseFormRegisterReturn } from 'react-hook-form';

export function AuthPanel({
  path,
  index,
  title,
  description,
  children,
}: {
  path: string;
  index: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="form-chrome">
        <span>~/{path}</span>
        <span aria-hidden="true">[ ↵ ]</span>
      </div>
      <section className="auth-form-inner" aria-labelledby="auth-title">
        <p className="form-index">{index}</p>
        <h2 id="auth-title" tabIndex={-1}>
          {title}
        </h2>
        <p className="form-description">{description}</p>
        {children}
      </section>
    </>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  registration: UseFormRegisterReturn;
};
export function Field({
  label,
  error,
  hint,
  registration,
  type = 'text',
  ...props
}: FieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={isPassword ? 'password-input' : undefined}>
        <input
          {...props}
          {...registration}
          id={id}
          type={isPassword && visible ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${id}-help` : undefined}
          spellCheck={false}
        />
        {isPassword && (
          <button
            type="button"
            className="icon-button"
            aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeSlash size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {(error || hint) && (
        <p id={`${id}-help`} className={error ? 'field-error' : 'field-hint'}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function Submit({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button className="primary auth-submit" type="submit" disabled={busy}>
      {busy ? 'One moment…' : children}
      <ArrowRight size={18} aria-hidden="true" />
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}
