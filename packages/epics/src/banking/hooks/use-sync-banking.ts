'use client';

import React from 'react';
import { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { SyncBankingResult } from './types';
import { getTransfersEndpoint } from './use-transfers';

export function getSyncBankingEndpoint(spaceSlug: string): string {
  return `/api/v1/spaces/${spaceSlug}/banking/sync`;
}

type UseSyncBankingOptions = {
  spaceSlug: string;
};

type UseSyncBankingReturn = {
  syncBanking: () => Promise<SyncBankingResult>;
  isSyncing: boolean;
  error: string | null;
};

export const useSyncBanking = ({
  spaceSlug,
}: UseSyncBankingOptions): UseSyncBankingReturn => {
  const { getAccessToken } = useAuthentication();
  const { mutate } = useSWRConfig();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const syncBanking = React.useCallback(async (): Promise<SyncBankingResult> => {
    setIsSyncing(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Unauthorized');
      }

      const endpoint = getSyncBankingEndpoint(spaceSlug);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = (await res.json().catch(() => ({}))) as
        | SyncBankingResult
        | { error?: string };

      if (!res.ok) {
        const message =
          typeof body === 'object' && body && 'error' in body && body.error
            ? String(body.error)
            : `Request failed (${res.status})`;
        throw new Error(message);
      }

      const result = body as SyncBankingResult;
      await mutate([getTransfersEndpoint(spaceSlug), 'transfers']);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to sync banking status';
      setError(message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [getAccessToken, mutate, spaceSlug]);

  return {
    syncBanking,
    isSyncing,
    error,
  };
};
