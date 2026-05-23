'use client';

import React from 'react';
import { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import type { BankTransferPublic } from './types';
import { getTransfersEndpoint } from './use-transfers';

type UseActivateTransferOptions = {
  spaceSlug: string;
};

export const useActivateTransfer = ({
  spaceSlug,
}: UseActivateTransferOptions) => {
  const { getAccessToken } = useAuthentication();
  const { mutate } = useSWRConfig();
  const [activatingTransferId, setActivatingTransferId] = React.useState<
    number | null
  >(null);
  const [failedTransferId, setFailedTransferId] = React.useState<number | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  const activateTransfer = React.useCallback(
    async (transferId: number): Promise<BankTransferPublic> => {
      setActivatingTransferId(transferId);
      setFailedTransferId(null);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Unauthorized');
        }
        const res = await fetch(
          `${getTransfersEndpoint(spaceSlug)}/${transferId}/activate`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const body = (await res.json().catch(() => ({}))) as
          | BankTransferPublic
          | { error?: string };
        if (!res.ok) {
          throw new Error(
            typeof body === 'object' && body && 'error' in body && body.error
              ? String(body.error)
              : `Request failed (${res.status})`,
          );
        }
        await mutate([getTransfersEndpoint(spaceSlug), 'transfers']);
        return body as BankTransferPublic;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to activate';
        setFailedTransferId(transferId);
        setError(message);
        throw err;
      } finally {
        setActivatingTransferId(null);
      }
    },
    [getAccessToken, mutate, spaceSlug],
  );

  return {
    activateTransfer,
    isActivating: activatingTransferId != null,
    activatingTransferId,
    failedTransferId,
    error,
    clearError: () => {
      setError(null);
      setFailedTransferId(null);
    },
  };
};
