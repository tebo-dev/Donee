import { z, type ZodType } from 'zod';
import { api, ApiError, type ApiOptions } from '../../lib/api';
import { tokenSchema, type TokenPair } from './contracts';

export const sessionKey = 'donee-session';
const storedSchema = tokenSchema.extend({
  id: z.string().uuid(),
  accessExpiresAt: z.number(),
  refreshExpiresAt: z.number(),
});
type StoredSession = z.infer<typeof storedSchema>;

// One controller per provider; refreshes are serialized and old results cannot restore a signed-out session.
export class SessionClient {
  current: StoredSession | null = null;
  private version = 0;
  private refreshing: Promise<string> | null = null;
  private claiming: Promise<boolean> | null = null;
  private release: (() => void) | null = null;
  onEnd: (message: string) => void = () => {};
  snapshot() {
    return this.current;
  }
  subscribe(onEnd: (message: string) => void) {
    this.onEnd = onEnd;
    return () => {
      this.onEnd = () => {};
    };
  }
  constructor() {
    try {
      sessionStorage.removeItem('donee-session-token');
      const stored = storedSchema.safeParse(
        JSON.parse(sessionStorage.getItem(sessionKey) || 'null'),
      );
      if (stored.success && navigator.locks) this.current = stored.data;
      else sessionStorage.removeItem(sessionKey);
    } catch {
      /* Storage may be unavailable. */
    }
  }
  private persist() {
    try {
      if (this.current && navigator.locks)
        sessionStorage.setItem(sessionKey, JSON.stringify(this.current));
      else sessionStorage.removeItem(sessionKey);
    } catch {
      /* Keep the login in memory if browser storage is blocked. */
    }
  }
  clear(message = '') {
    this.version += 1;
    this.current = null;
    this.refreshing = null;
    this.release?.();
    this.release = null;
    this.claiming = null;
    this.persist();
    this.onEnd(message);
  }
  private async claim() {
    if (this.release) return true;
    if (this.claiming) return this.claiming;
    if (!this.current) return false;
    // A duplicated tab must sign in independently instead of replaying a copied refresh token.
    if (!navigator.locks) {
      this.persist();
      return true;
    }
    const version = this.version;
    const id = this.current.id;
    this.claiming = new Promise<boolean>((resolve) => {
      void navigator.locks
        .request(`donee-login-${id}`, { ifAvailable: true }, async (lock) => {
          if (!lock || version !== this.version) {
            resolve(false);
            return;
          }
          await new Promise<void>((release) => {
            this.release = release;
            resolve(true);
          });
        })
        .catch(() => resolve(false));
    });
    const owned = await this.claiming;
    if (!owned && version === this.version)
      this.clear(
        'This login is already open in another tab. Please sign in here separately.',
      );
    return owned;
  }
  async install(pair: TokenPair) {
    this.clear();
    this.current = {
      ...pair,
      id: crypto.randomUUID(),
      accessExpiresAt: Date.now() + pair.expires_in * 1000,
      refreshExpiresAt: Date.now() + pair.refresh_expires_in * 1000,
    };
    if (!(await this.claim())) throw new ApiError('Please sign in again.', 401);
    this.persist();
  }
  private async refresh() {
    if (this.refreshing) return this.refreshing;
    const previous = this.current;
    if (!previous || previous.refreshExpiresAt <= Date.now()) {
      this.clear('Your session expired. Please sign in again.');
      throw new ApiError('Please sign in again.', 401);
    }
    const version = this.version;
    const pending = (async () => {
      // A reload during rotation must not replay the credential being consumed.
      try {
        sessionStorage.removeItem(sessionKey);
      } catch {
        /* Memory-only login. */
      }
      try {
        const pair = await api('/auth/refresh', tokenSchema, {
          body: { refresh_token: previous.refresh_token },
        });
        if (version !== this.version)
          throw new ApiError(
            'Your session changed. Please sign in again.',
            401,
          );
        this.current = {
          ...pair,
          id: previous.id,
          accessExpiresAt: Date.now() + pair.expires_in * 1000,
          refreshExpiresAt: Math.min(
            previous.refreshExpiresAt,
            Date.now() + pair.refresh_expires_in * 1000,
          ),
        };
        this.persist();
        return pair.access_token;
      } catch (error) {
        if (version === this.version)
          this.clear(
            error instanceof ApiError && error.status === 429
              ? 'Session renewal was rate-limited. Wait before signing in again.'
              : error instanceof ApiError && error.status === 401
                ? 'Your session expired or was revoked. Please sign in again.'
                : 'Session renewal could not be confirmed. Please sign in again to reconnect safely.',
          );
        throw error;
      }
    })();
    this.refreshing = pending;
    try {
      return await pending;
    } finally {
      if (this.refreshing === pending) this.refreshing = null;
    }
  }
  async request<T>(
    path: string,
    schema: ZodType<T>,
    options: Omit<ApiOptions, 'token'> = {},
  ): Promise<T> {
    const version = this.version;
    if (!(await this.claim()) || !this.current || version !== this.version)
      throw new ApiError('Please sign in again.', 401);
    let used = this.current.access_token;
    let renewed = false;
    if (
      this.refreshing ||
      this.current.accessExpiresAt <= Date.now() + 30_000
    ) {
      used = await this.refresh();
      renewed = true;
    }
    try {
      let result: T;
      try {
        result = await api(path, schema, { ...options, token: used });
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          error.status !== 401 ||
          version !== this.version ||
          renewed
        )
          throw error;
        // Another request may already have rotated this token while this request was in flight.
        used =
          this.current && this.current.access_token !== used
            ? this.current.access_token
            : await this.refresh();
        result = await api(path, schema, { ...options, token: used });
      }
      if (version !== this.version)
        throw new ApiError('Your session changed. Please try again.', 401);
      return result;
    } catch (error) {
      if (
        version === this.version &&
        error instanceof ApiError &&
        error.status === 401
      )
        this.clear(
          'Your session expired or was revoked. Please sign in again.',
        );
      throw error;
    }
  }
}
