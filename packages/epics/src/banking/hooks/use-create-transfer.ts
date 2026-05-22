'use client';

import React from 'react';
import { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankTransferPublic, BankVirtualAccountCurrency } from './types';
import { getTransfersEndpoint } from './use-transfers';

type UseCreateTransferOptions = {
  spaceSlug: string;
};

type UseCreateTransferReturn = {
  createTransfer: (input: {
    currency: BankVirtualAccountCurrency;
    amount?: string;
  }) => Promise<BankTransferPublic>;
  isCreating: boolean;
  error: string | null;
  clearError: () => void;
};

export const useCreateTransfer = ({
  spaceSlug,
}: UseCreateTransferOptions): UseCreateTransferReturn => {
  const { getAccessToken } = useAuthentication();
  const { mutate } = useSWRConfig();
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const createTransfer = React.useCallback(
    async (input: {
      currency: BankVirtualAccountCurrency;
      amount?: string;
      legalName?: string;
      contactEmail?: string;
    }): Promise<BankTransferPublic> => {
      setIsCreating(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Unauthorized');
        }

        const endpoint = getTransfersEndpoint(spaceSlug);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });

        const body = (await res.json().catch(() => ({}))) as
          | BankTransferPublic
          | { error?: string };

        if (!res.ok) {
          const message =
            typeof body === 'object' && body && 'error' in body && body.error
              ? String(body.error)
              : `Request failed (${res.status})`;
          throw new Error(message);
        }

        const result = body as BankTransferPublic;
        await mutate([endpoint, 'transfers']);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to create payment request';
        setError(message);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [getAccessToken, mutate, spaceSlug],
  );

  const clearError = React.useCallback(() => setError(null), []);

  return {
    createTransfer,
    isCreating,
    error,
    clearError,
  };
};
