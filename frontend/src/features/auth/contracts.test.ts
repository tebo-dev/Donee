import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  registerSchema,
  resetSchema,
  verifySchema,
} from './contracts';

describe('auth validation at the API boundary', () => {
  it('matches backend whitespace normalization and rejects passwords outside its limits', () => {
    expect(
      loginSchema.parse({
        email: ' human@example.com ',
        password: '  longpassword  ',
      }),
    ).toEqual({ email: 'human@example.com', password: 'longpassword' });
    for (const password of ['short', 'x'.repeat(129)])
      expect(
        loginSchema.safeParse({ email: 'human@example.com', password }).success,
      ).toBe(false);
  });
  it('requires confirmation and a username within the backend limits', () => {
    const account = {
      username: 'human',
      email: 'human@example.com',
      password: 'longpassword',
      confirm: 'different',
    };
    const result = registerSchema.safeParse(account);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.path).toEqual(['confirm']);
    expect(
      registerSchema.safeParse({
        ...account,
        confirm: account.password,
        username: 'hi',
      }).success,
    ).toBe(false);
    expect(
      resetSchema.safeParse({
        new_password: 'longpassword',
        confirm: 'different',
      }).success,
    ).toBe(false);
  });
  it('accepts a pasted six-digit code with a leading zero and rejects other characters', () => {
    expect(
      verifySchema.parse({ email: 'human@example.com', code: '012345' }).code,
    ).toBe('012345');
    expect(
      verifySchema.safeParse({ email: 'human@example.com', code: '12e345' })
        .success,
    ).toBe(false);
  });
});
