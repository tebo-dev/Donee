import type { Page } from '@playwright/test';
import type { TokenPair } from '../src/features/auth/contracts';
const sessions = new Map<string, TokenPair>();
export function rememberSession(pair: TokenPair) {
  sessions.set(pair.access_token, pair);
  return pair.access_token;
}
export async function installSession(page: Page, token: string) {
  const pair = sessions.get(token);
  if (!pair) throw new Error('Missing test session');
  await page.evaluate(
    (value) =>
      sessionStorage.setItem(
        'donee-session',
        JSON.stringify({
          ...value,
          id: crypto.randomUUID(),
          accessExpiresAt: Date.now() + value.expires_in * 1000,
          refreshExpiresAt: Date.now() + value.refresh_expires_in * 1000,
        }),
      ),
    pair,
  );
}
