'use client';

import { useCallback } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';

/**
 * The developer area talks to the integration API only, with the signed-in
 * user's token. Nothing here is shared with the rest of the web app, so the
 * area can move to its own site (see the README note in the outbox).
 */
export const INTEGRATION_API = '/api/integration/v1';

export type ClientStatus = 'pending' | 'approved' | 'revoked';

export type DeveloperClient = {
  slug: string;
  name: string;
  description: string | null;
  status: ClientStatus;
  scopes: string[];
  allowedOrigins: string[];
  keyPrefix: string | null;
  createdAt: string;
  contactEmail?: string;
  logo: { state: 'none' | 'in_review' | 'approved'; url: string | null };
};

export const SCOPE_LABELS: Record<string, string> = {
  'agreements:vote':
    'Prepare a vote on an agreement, for the person to confirm in Hypha',
};

export function useDeveloperApi() {
  const { getAccessToken } = useAuthentication();
  return useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getAccessToken();
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token ?? ''}`);
      // A multipart body sets its own content type (with the boundary).
      if (typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }
      return fetch(`${INTEGRATION_API}${path}`, { ...init, headers });
    },
    [getAccessToken],
  );
}

/** A readable line from an integration API error body. */
export async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    details?: { fieldErrors?: Record<string, string[] | undefined> };
  };
  const fields = Object.entries(body.details?.fieldErrors ?? {})
    .map(([field, messages]) => `${field}: ${(messages ?? []).join(', ')}`)
    .join('; ');
  return [body.error ?? `Request failed (${res.status})`, fields]
    .filter(Boolean)
    .join(' — ');
}
