'use client';

import { useCallback, useState } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankCustomerPublicStatus } from './types';
import { resolveBankingBasePath } from './banking-endpoints';

export type RequestEndorsementKycResult = {
  status: BankCustomerPublicStatus;
  kycLinkUrl: string;
};

type UseRequestEndorsementKycOptions = {
  spaceSlug?: string;
  /** Owner-agnostic base path (e.g. person-scoped). Defaults to the space path. */
  basePath?: string;
};

export function useRequestEndorsementKyc({
  spaceSlug,
  basePath,
}: UseRequestEndorsementKycOptions) {
  const { getAccessToken } = useAuthentication();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestEndorsementKyc = useCallback(
    async (endorsement: string): Promise<RequestEndorsementKycResult> => {
      setIsLoading(true);
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

        const res = await fetch(`${base}/endorsement-kyc`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ endorsement }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? 'Failed to request verification');
        }

        return (await res.json()) as RequestEndorsementKycResult;
      } catch (err) {
        const next =
          err instanceof Error
            ? err
            : new Error('Failed to request verification');
        setError(next);
        throw next;
      } finally {
        setIsLoading(false);
      }
    },
    [getAccessToken, spaceSlug, basePath],
  );

  return { requestEndorsementKyc, isLoading, error };
}
