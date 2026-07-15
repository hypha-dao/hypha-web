'use client';

import React from 'react';
import { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type {
  BankVirtualAccountCurrency,
  CreateBankAccountResult,
} from './types';
import { resolveBankingBasePath } from './banking-endpoints';

type UseProvisionVirtualAccountOptions = {
  spaceSlug?: string;
  /** Owner-agnostic base path (e.g. person-scoped). Defaults to the space path. */
  basePath?: string;
};

type UseProvisionVirtualAccountReturn = {
  createAccount: (
    currency: BankVirtualAccountCurrency,
    options?: { destinationCurrency?: string },
  ) => Promise<CreateBankAccountResult>;
  isCreating: boolean;
  creatingCurrency: BankVirtualAccountCurrency | null;
  error: string | null;
  clearError: () => void;
};

export const useProvisionVirtualAccount = ({
  spaceSlug,
  basePath,
}: UseProvisionVirtualAccountOptions): UseProvisionVirtualAccountReturn => {
  const { getAccessToken } = useAuthentication();
  const { mutate } = useSWRConfig();
  const [isCreating, setIsCreating] = React.useState(false);
  const [creatingCurrency, setCreatingCurrency] =
    React.useState<BankVirtualAccountCurrency | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const createAccount = React.useCallback(
    async (
      currency: BankVirtualAccountCurrency,
      options?: { destinationCurrency?: string },
    ): Promise<CreateBankAccountResult> => {
      setIsCreating(true);
      setCreatingCurrency(currency);
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
        const endpoint = `${base}/accounts`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currency,
            ...(options?.destinationCurrency
              ? { destinationCurrency: options.destinationCurrency }
              : {}),
          }),
        });

        const body = (await res.json().catch(() => ({}))) as
          | CreateBankAccountResult
          | { error?: string };

        if (!res.ok) {
          const message =
            typeof body === 'object' && body && 'error' in body && body.error
              ? String(body.error)
              : `Request failed (${res.status})`;
          throw new Error(message);
        }

        const result = body as CreateBankAccountResult;
        await Promise.all([
          mutate([endpoint, 'virtual-accounts']),
          mutate(`${base}/bank-customers`),
        ]);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create bank account';
        setError(message);
        throw err;
      } finally {
        setIsCreating(false);
        setCreatingCurrency(null);
      }
    },
    [getAccessToken, mutate, spaceSlug, basePath],
  );

  const clearError = React.useCallback(() => setError(null), []);

  return {
    createAccount,
    isCreating,
    creatingCurrency,
    error,
    clearError,
  };
};
