'use client';

import React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';

import { resolveBankingBasePath } from './banking-endpoints';

type UseSimulateKycApprovalOptions = {
  spaceSlug?: string;
  /** Owner-agnostic base path (e.g. person-scoped). Defaults to the space path. */
  basePath?: string;
};

export type SimulateKycApprovalOptions = {
  /** When true (default), apply mock KYB data on Bridge after approval simulation. */
  includeKybData?: boolean;
};

type UseSimulateKycApprovalReturn = {
  simulateApproval: (options?: SimulateKycApprovalOptions) => Promise<void>;
  isSimulating: boolean;
  error: string | null;
  clearError: () => void;
};

export const useSimulateKycApproval = ({
  spaceSlug,
  basePath,
}: UseSimulateKycApprovalOptions): UseSimulateKycApprovalReturn => {
  const { getAccessToken } = useAuthentication();
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const simulateApproval = React.useCallback(
    async (options?: SimulateKycApprovalOptions): Promise<void> => {
      setIsSimulating(true);
      setError(null);

      const includeKybData = options?.includeKybData !== false;

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Unauthorized');
        }

        const base = resolveBankingBasePath({ spaceSlug, basePath });
        if (!base) {
          throw new Error('Missing banking endpoint');
        }
        const endpoint = `${base}/sandbox/simulate-kyc-approval`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ includeKybData }),
        });

        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!res.ok) {
          const message =
            typeof body === 'object' && body && 'error' in body && body.error
              ? String(body.error)
              : `Request failed (${res.status})`;
          throw new Error(message);
        }

        // Caller refreshes bank customer status after success.
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to simulate KYB approval';
        setError(message);
        throw err;
      } finally {
        setIsSimulating(false);
      }
    },
    [getAccessToken, spaceSlug, basePath],
  );

  const clearError = React.useCallback(() => setError(null), []);

  return {
    simulateApproval,
    isSimulating,
    error,
    clearError,
  };
};
