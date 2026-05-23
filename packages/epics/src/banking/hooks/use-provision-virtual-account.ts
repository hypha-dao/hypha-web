'use client';

import React from 'react';
import { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type {
  BankVirtualAccountCurrency,
  CreateBankAccountResult,
} from './types';
import { getBankCustomerStatusEndpoint } from './use-bank-customer-status';
import { getVirtualAccountsEndpoint } from './use-virtual-accounts';

type UseProvisionVirtualAccountOptions = {
  spaceSlug: string;
};

type UseProvisionVirtualAccountReturn = {
  createAccount: (
    currency: BankVirtualAccountCurrency,
  ) => Promise<CreateBankAccountResult>;
  isCreating: boolean;
  creatingCurrency: BankVirtualAccountCurrency | null;
  error: string | null;
  clearError: () => void;
};

export const useProvisionVirtualAccount = ({
  spaceSlug,
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
    ): Promise<CreateBankAccountResult> => {
      setIsCreating(true);
      setCreatingCurrency(currency);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Unauthorized');
        }

        const endpoint = getVirtualAccountsEndpoint(spaceSlug);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ currency }),
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
          mutate(getBankCustomerStatusEndpoint(spaceSlug)),
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
    [getAccessToken, mutate, spaceSlug],
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
