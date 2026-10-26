import { z } from 'zod';

// Normalize identity fields; passwords are preserved exactly.
export const email = z.string().trim().email('Enter a valid email address.');
export const password = z
  .string()
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
    termsAccepted: z
      .boolean()
      .refine(
        (value) => value,
        'Agree to the Terms of service and Acceptable use policy to create an account.',
      ),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    message: 'Those passwords do not match.',
  });
export const forgotSchema = z.object({ email });
export const verifySchema = z.object({ email, code });
export const resetSchema = z
  .object({ new_password: password, confirm: z.string() })
  .refine((value) => value.new_password === value.confirm, {
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
  refresh_token: z.string().min(40),
  expires_in: z.number().int().positive(),
  refresh_expires_in: z.number().int().positive(),
});
export const messageSchema = z.object({ message: z.string() });
export type User = z.infer<typeof userSchema>;

export type TokenPair = z.infer<typeof tokenSchema>;
