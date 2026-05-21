'use client';

import React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';

type UseSimulateKycApprovalOptions = {
  spaceSlug: string;
};

type UseSimulateKycApprovalReturn = {
  simulateApproval: () => Promise<void>;
  isSimulating: boolean;
  error: string | null;
  clearError: () => void;
};

function getSimulateKycApprovalEndpoint(spaceSlug: string): string {
  return `/api/v1/spaces/${spaceSlug}/banking/sandbox/simulate-kyc-approval`;
}

export const useSimulateKycApproval = ({
  spaceSlug,
}: UseSimulateKycApprovalOptions): UseSimulateKycApprovalReturn => {
  const { getAccessToken } = useAuthentication();
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const simulateApproval = React.useCallback(async (): Promise<void> => {
    setIsSimulating(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Unauthorized');
      }

      const endpoint = getSimulateKycApprovalEndpoint(spaceSlug);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        const message =
          typeof body === 'object' && body && 'error' in body && body.error
            ? String(body.error)
            : `Request failed (${res.status})`;
        throw new Error(message);
      }

      // Do not mutate SWR or update banking UI — simulate manual refresh + lazy sync.
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to simulate KYB approval';
      setError(message);
      throw err;
    } finally {
      setIsSimulating(false);
    }
  }, [getAccessToken, spaceSlug]);

  const clearError = React.useCallback(() => setError(null), []);

  return {
    simulateApproval,
    isSimulating,
    error,
    clearError,
  };
};
