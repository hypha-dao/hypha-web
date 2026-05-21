'use client';

import React from 'react';
import { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type {
  BankVirtualAccountCurrency,
  ProvisionVirtualAccountResult,
} from './types';
import { getVirtualAccountsEndpoint } from './use-virtual-accounts';

type UseProvisionVirtualAccountOptions = {
  spaceSlug: string;
};

type UseProvisionVirtualAccountReturn = {
  provisionAccount: (
    currency: BankVirtualAccountCurrency,
  ) => Promise<ProvisionVirtualAccountResult>;
  isProvisioning: boolean;
  provisioningCurrency: BankVirtualAccountCurrency | null;
  error: string | null;
  clearError: () => void;
};

export const useProvisionVirtualAccount = ({
  spaceSlug,
}: UseProvisionVirtualAccountOptions): UseProvisionVirtualAccountReturn => {
  const { getAccessToken } = useAuthentication();
  const { mutate } = useSWRConfig();
  const [isProvisioning, setIsProvisioning] = React.useState(false);
  const [provisioningCurrency, setProvisioningCurrency] =
    React.useState<BankVirtualAccountCurrency | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const provisionAccount = React.useCallback(
    async (
      currency: BankVirtualAccountCurrency,
    ): Promise<ProvisionVirtualAccountResult> => {
      setIsProvisioning(true);
      setProvisioningCurrency(currency);
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
          | ProvisionVirtualAccountResult
          | { error?: string };

        if (!res.ok) {
          const message =
            typeof body === 'object' && body && 'error' in body && body.error
              ? String(body.error)
              : `Request failed (${res.status})`;
          throw new Error(message);
        }

        const result = body as ProvisionVirtualAccountResult;
        await mutate([endpoint, 'virtual-accounts']);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to set up deposit account';
        setError(message);
        throw err;
      } finally {
        setIsProvisioning(false);
        setProvisioningCurrency(null);
      }
    },
    [getAccessToken, mutate, spaceSlug],
  );

  const clearError = React.useCallback(() => setError(null), []);

  return {
    provisionAccount,
    isProvisioning,
    provisioningCurrency,
    error,
    clearError,
  };
};
