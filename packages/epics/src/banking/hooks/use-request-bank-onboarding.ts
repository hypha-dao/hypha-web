'use client';

import React from 'react';
import { useSWRConfig } from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

import {
  type BankOnboardingRequestInput,
  type BankOnboardingRequestResult,
} from './types';
import { getBankCustomerStatusEndpoint } from './use-bank-customer-status';

type UseRequestBankOnboardingOptions = {
  spaceSlug: string;
};

type UseRequestBankOnboardingReturn = {
  requestOnboarding: (
    input: BankOnboardingRequestInput,
  ) => Promise<BankOnboardingRequestResult>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
};

export const useRequestBankOnboarding = ({
  spaceSlug,
}: UseRequestBankOnboardingOptions): UseRequestBankOnboardingReturn => {
  const { getAccessToken } = useAuthentication();
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const requestOnboarding = React.useCallback(
    async (
      input: BankOnboardingRequestInput,
    ): Promise<BankOnboardingRequestResult> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Unauthorized');
        }

        const endpoint = getBankCustomerStatusEndpoint(spaceSlug);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });

        const body = (await res.json().catch(() => ({}))) as
          | BankOnboardingRequestResult
          | { error?: string };

        if (!res.ok) {
          const message =
            typeof body === 'object' && body && 'error' in body && body.error
              ? String(body.error)
              : `Request failed (${res.status})`;
          throw new Error(message);
        }

        const result = body as BankOnboardingRequestResult;
        await mutate(endpoint);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to start bank onboarding';
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [getAccessToken, mutate, spaceSlug],
  );

  const clearError = React.useCallback(() => setError(null), []);

  return {
    requestOnboarding,
    isSubmitting,
    error,
    clearError,
  };
};
