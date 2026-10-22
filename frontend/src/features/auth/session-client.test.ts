import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { SessionClient } from './session-client';
const pair = {
  access_token: 'access-one',
  refresh_token: 'r'.repeat(64),
  token_type: 'bearer' as const,
  expires_in: 900,
  refresh_expires_in: 3600,
};
const next = {
  ...pair,
  access_token: 'access-two',
  refresh_token: 's'.repeat(64),
};
const schema = z.object({ ok: z.boolean() });
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rotating sessions', () => {
  it('shares one refresh across concurrent protected calls and replaces both tokens', async () => {
    const client = new SessionClient();
    await client.install(pair);
    client.current!.accessExpiresAt = 0;
    let finish!: (value: Response) => void;
    const fetcher = vi.fn((url: string) =>
      url.endsWith('/auth/refresh')
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(response({ ok: true })),
    );
    vi.stubGlobal('fetch', fetcher);
    const one = client.request('/one', schema);
    const two = client.request('/two', schema);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    finish(response(next));
    await Promise.all([one, two]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(client.current?.refresh_token).toBe(next.refresh_token);
    expect(client.current?.access_token).toBe(next.access_token);
    for (const call of fetcher.mock.calls.slice(1))
      expect(
        (call as unknown as [string, RequestInit])[1].headers,
      ).toMatchObject({ Authorization: 'Bearer access-two' });
    client.clear();
  });
  it('refreshes once after a 401, but never loops when the retried request is rejected', async () => {
    const client = new SessionClient();
    await client.install(pair);
    const fetcher = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/auth/refresh')
          ? response(next)
          : response({ detail: 'Invalid session' }, 401),
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(client.request('/one', schema)).rejects.toMatchObject({
      status: 401,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(client.current).toBeNull();
  });
  it.each([0, 401, 429])(
    'ends the session without replaying a refresh after failure %s',
    async (status) => {
      const client = new SessionClient();
      await client.install(pair);
      client.current!.accessExpiresAt = 0;
      const ended = vi.fn();
      client.onEnd = ended;
      const fetcher = vi.fn(() =>
        status
          ? Promise.resolve(response({ detail: 'Rejected' }, status))
          : Promise.reject(new TypeError('Disconnected')),
      );
      vi.stubGlobal('fetch', fetcher);
      await expect(client.request('/one', schema)).rejects.toThrow();
      await expect(client.request('/two', schema)).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(client.current).toBeNull();
      expect(ended).toHaveBeenCalledWith(
        expect.stringMatching(
          status === 429
            ? /rate-limited/
            : status === 401
              ? /expired or was revoked/
              : /could not be confirmed/,
        ),
      );
    },
  );
  it('cannot restore a signed-out session with a late refresh response', async () => {
    const client = new SessionClient();
    await client.install(pair);
    client.current!.accessExpiresAt = 0;
    let finish!: (value: Response) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const pending = client.request('/one', schema);
    const rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    client.clear();
    finish(response(next));
    await rejected;
    expect(client.current).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
