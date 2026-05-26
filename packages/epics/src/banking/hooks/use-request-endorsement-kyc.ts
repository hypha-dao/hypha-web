'use client';

import { useCallback, useState } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankCustomerPublicStatus } from './types';

export type RequestEndorsementKycResult = {
  status: BankCustomerPublicStatus;
  kycLinkUrl: string;
};

export function useRequestEndorsementKyc(spaceSlug: string) {
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

        const res = await fetch(
          `/api/v1/spaces/${spaceSlug}/banking/endorsement-kyc`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ endorsement }),
          },
        );

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? 'Failed to request verification');
        }

        return (await res.json()) as RequestEndorsementKycResult;
      } catch (err) {
        const next =
          err instanceof Error ? err : new Error('Failed to request verification');
        setError(next);
        throw next;
      } finally {
        setIsLoading(false);
      }
    },
    [getAccessToken, spaceSlug],
  );

  return { requestEndorsementKyc, isLoading, error };
}
