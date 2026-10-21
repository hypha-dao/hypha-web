'use client';

import type { ApiError } from '@rs/lib/campaign-types';

/**
 * Thin fetch wrapper. Every authenticated call carries the Privy access token
 * as a bearer; the token is fetched per request rather than cached, because
 * Privy rotates it and a stale one is indistinguishable from being signed out.
 */

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export type TokenGetter = () => Promise<string | null>;

async function request<T>(
  path: string,
  init: RequestInit & { getToken?: TokenGetter } = {},
): Promise<T> {
  const { getToken, headers, ...rest } = init;
  const token = getToken ? await getToken() : null;

  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & Partial<ApiError>)
    | null;

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      payload?.error ?? `Request failed (${response.status})`,
      payload?.details,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, getToken?: TokenGetter) =>
    request<T>(path, { method: 'GET', getToken, cache: 'no-store' }),

  post: <T>(path: string, body?: unknown, getToken?: TokenGetter) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      getToken,
    }),

  put: <T>(path: string, body?: unknown, getToken?: TokenGetter) =>
    request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
      getToken,
    }),

  patch: <T>(path: string, body?: unknown, getToken?: TokenGetter) =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
      getToken,
    }),

  delete: <T>(path: string, getToken?: TokenGetter) =>
    request<T>(path, { method: 'DELETE', getToken }),
};
