import { z } from 'zod';

// Match FastAPI's str_strip_whitespace and field limits before sending values.
export const email = z.string().trim().email('Enter a valid email address.');
export const password = z
  .string()
  .trim()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use no more than 128 characters.');
export const code = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, 'Enter the six-digit code from your email.');
export const loginSchema = z.object({ email, password });
export const registerSchema = loginSchema
  .extend({
    username: z
      .string()
      .trim()
      .min(3, 'Use at least 3 characters.')
      .max(50, 'Use no more than 50 characters.'),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm.trim(), {
    path: ['confirm'],
    message: 'Those passwords do not match.',
  });
export const forgotSchema = z.object({ email });
export const verifySchema = z.object({ email, code });
export const resetSchema = z
  .object({ new_password: password, confirm: z.string() })
  .refine((value) => value.new_password === value.confirm.trim(), {
    path: ['confirm'],
    message: 'Those passwords do not match.',
  });
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string(),
});
export const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal('bearer'),
});
export const messageSchema = z.object({ message: z.string() });
export type User = z.infer<typeof userSchema>;
