import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(
  /\/$/,
  '',
);
const problem = z.object({ detail: z.string() });
export type ApiOptions = {
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
  method?: 'GET' | 'POST' | 'PATCH';
};

export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || (options.body === undefined ? 'GET' : 'POST'),
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'omit',
      cache: 'no-store',
      signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = problem.safeParse(data);
      const retry = Number(response.headers.get('Retry-After'));
      const message =
        response.status === 429
          ? 'Too many attempts. Please wait before trying again.'
          : response.status >= 500
            ? 'Donee could not complete that request. Please try again shortly.'
            : parsed.success
              ? parsed.data.detail
              : response.status === 422
                ? 'Check your details and try again.'
                : 'That request could not be completed. Please try again.';
      throw new ApiError(
        message,
        response.status,
        retry > 0 ? retry : undefined,
      );
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new ApiError(
        'Donee returned an unexpected response. Please try again.',
      );
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? 'That took too long. Check your connection and try again.'
        : 'Cannot reach Donee. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
  }
}
