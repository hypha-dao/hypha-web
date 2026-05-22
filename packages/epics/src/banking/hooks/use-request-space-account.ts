'use client';

import React from 'react';
import { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankCurrencyCode } from '../bank-currency-display';
import type { BankVirtualAccountPublic } from './types';
import { getVirtualAccountsEndpoint } from './use-virtual-accounts';

export function getSpaceAccountEndpoint(spaceSlug: string): string {
  return `/api/v1/spaces/${spaceSlug}/banking/space-account`;
}

type UseRequestSpaceAccountOptions = {
  spaceSlug: string;
};

export const useRequestSpaceAccount = ({
  spaceSlug,
}: UseRequestSpaceAccountOptions) => {
  const { getAccessToken } = useAuthentication();
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const requestSpaceAccount = React.useCallback(
    async (input: {
      legalName?: string;
      contactEmail?: string;
      currencies: BankCurrencyCode[];
    }): Promise<BankVirtualAccountPublic[]> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Unauthorized');
        }
        const res = await fetch(getSpaceAccountEndpoint(spaceSlug), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            legalName: input.legalName,
            contactEmail: input.contactEmail,
            currencies: input.currencies,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as
          | BankVirtualAccountPublic[]
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
        return body as BankVirtualAccountPublic[];
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to open space account';
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [getAccessToken, mutate, spaceSlug],
  );

  return {
    requestSpaceAccount,
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
};
