'use client';

import React from 'react';
import { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankVirtualAccountPublic } from './types';
import { getVirtualAccountsEndpoint } from './use-virtual-accounts';

type UseActivateVirtualAccountOptions = {
  spaceSlug: string;
};

export const useActivateVirtualAccount = ({
  spaceSlug,
}: UseActivateVirtualAccountOptions) => {
  const { getAccessToken } = useAuthentication();
  const { mutate } = useSWRConfig();
  const [isActivating, setIsActivating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const activateAccount = React.useCallback(
    async (accountId: number): Promise<BankVirtualAccountPublic> => {
      setIsActivating(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Unauthorized');
        }
        const res = await fetch(
          `${getVirtualAccountsEndpoint(spaceSlug)}/${accountId}/activate`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const body = (await res.json().catch(() => ({}))) as
          | BankVirtualAccountPublic
          | { error?: string };
        if (!res.ok) {
          throw new Error(
            typeof body === 'object' && body && 'error' in body && body.error
              ? String(body.error)
              : `Request failed (${res.status})`,
          );
        }
        await mutate([
          getVirtualAccountsEndpoint(spaceSlug),
          'virtual-accounts',
        ]);
        return body as BankVirtualAccountPublic;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to activate';
        setError(message);
        throw err;
      } finally {
        setIsActivating(false);
      }
    },
    [getAccessToken, mutate, spaceSlug],
  );

  return {
    activateAccount,
    isActivating,
    error,
    clearError: () => setError(null),
  };
};
