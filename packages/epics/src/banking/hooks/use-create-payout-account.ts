'use client';

import React from 'react';
import { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type {
  CreatePayoutAccountInput,
  CreatePayoutAccountResult,
} from './types';
import { resolveBankingBasePath } from './banking-endpoints';

type UseCreatePayoutAccountOptions = {
  spaceSlug?: string;
  /** Owner-agnostic base path (e.g. person-scoped). Defaults to the space path. */
  basePath?: string;
};

type UseCreatePayoutAccountReturn = {
  createPayoutAccount: (
    input: CreatePayoutAccountInput,
  ) => Promise<CreatePayoutAccountResult>;
  isCreating: boolean;
  error: string | null;
  clearError: () => void;
};

export const useCreatePayoutAccount = ({
  spaceSlug,
  basePath,
}: UseCreatePayoutAccountOptions): UseCreatePayoutAccountReturn => {
  const { getAccessToken } = useAuthentication();
  const { mutate } = useSWRConfig();
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const createPayoutAccount = React.useCallback(
    async (
      input: CreatePayoutAccountInput,
    ): Promise<CreatePayoutAccountResult> => {
      setIsCreating(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Unauthorized');
        }

        const base = resolveBankingBasePath({ spaceSlug, basePath });
        if (!base) {
          throw new Error('Missing banking endpoint');
        }
        const endpoint = `${base}/payout-accounts`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });

        const body = (await res.json().catch(() => ({}))) as
          | CreatePayoutAccountResult
          | { error?: string };

        if (!res.ok) {
          const message =
            typeof body === 'object' && body && 'error' in body && body.error
              ? String(body.error)
              : `Request failed (${res.status})`;
          throw new Error(message);
        }

        const result = body as CreatePayoutAccountResult;
        await mutate([endpoint, 'payout-accounts']);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to create payout account';
        setError(message);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [getAccessToken, mutate, spaceSlug, basePath],
  );

  const clearError = React.useCallback(() => setError(null), []);

  return {
    createPayoutAccount,
    isCreating,
    error,
    clearError,
  };
};
