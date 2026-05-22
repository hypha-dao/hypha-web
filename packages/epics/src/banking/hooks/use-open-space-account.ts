'use client';

import React from 'react';

import {
  currenciesToEndorsements,
  getCorridorForCurrency,
  type BankCurrencyCode,
} from '../bank-currency-display';
import type {
  BankCustomerPublicStatus,
  BankOnboardingRequestInput,
  BankVirtualAccountPublic,
} from './types';
import { useBankCustomerStatus } from './use-bank-customer-status';
import { useProvisionVirtualAccount } from './use-provision-virtual-account';
import { useRequestBankOnboarding } from './use-request-bank-onboarding';

export type OpenSpaceAccountInput = {
  legalName: string;
  contactEmail: string;
  currencies: BankCurrencyCode[];
};

export type OpenSpaceAccountResult =
  | { action: 'provisioned'; currencies: BankCurrencyCode[] }
  | {
      action: 'redirect';
      tosLink: string | null;
      kycLink: string | null;
    }
  | {
      action: 'already_pending';
      tosLink: string | null;
      kycLink: string | null;
    };

type UseOpenSpaceAccountOptions = {
  spaceSlug: string;
  virtualAccounts: BankVirtualAccountPublic[];
  onAccountsRefresh: () => void;
};

type UseOpenSpaceAccountReturn = {
  submit: (input: OpenSpaceAccountInput) => Promise<OpenSpaceAccountResult>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
  status: BankCustomerPublicStatus | null | undefined;
  refreshStatus: () => Promise<void>;
};

function isCurrencyProvisioned(
  accounts: BankVirtualAccountPublic[],
  currency: BankCurrencyCode,
): boolean {
  const corridor = getCorridorForCurrency(currency);
  if (!corridor) {
    return false;
  }
  return accounts.some(
    (a) =>
      a.currency === corridor.currency &&
      a.paymentRail === corridor.paymentRail,
  );
}

export const useOpenSpaceAccount = ({
  spaceSlug,
  virtualAccounts,
  onAccountsRefresh,
}: UseOpenSpaceAccountOptions): UseOpenSpaceAccountReturn => {
  const { status, refresh } = useBankCustomerStatus({ spaceSlug });
  const { requestOnboarding } = useRequestBankOnboarding({ spaceSlug });
  const { provisionAccount } = useProvisionVirtualAccount({ spaceSlug });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const clearError = React.useCallback(() => setError(null), []);

  const refreshStatus = React.useCallback(async () => {
    await refresh();
  }, [refresh]);

  const provisionCurrencies = React.useCallback(
    async (currencies: BankCurrencyCode[]) => {
      const toProvision = currencies.filter(
        (c) => !isCurrencyProvisioned(virtualAccounts, c),
      );
      for (const currency of toProvision) {
        await provisionAccount(currency);
      }
      if (toProvision.length > 0) {
        onAccountsRefresh();
        await refresh();
      }
      return toProvision;
    },
    [onAccountsRefresh, provisionAccount, refresh, virtualAccounts],
  );

  const submit = React.useCallback(
    async (input: OpenSpaceAccountInput): Promise<OpenSpaceAccountResult> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const endorsements = currenciesToEndorsements(input.currencies);
        if (endorsements.length === 0) {
          throw new Error('Select at least one currency');
        }

        let currentStatus = status;

        if (currentStatus == null) {
          const onboardingInput: BankOnboardingRequestInput = {
            legalName: input.legalName.trim(),
            contactEmail: input.contactEmail.trim(),
            endorsements,
          };
          const result = await requestOnboarding(onboardingInput);
          await refresh();
          currentStatus = {
            kycStatus: result.kycStatus,
            kycLink: result.kycLink,
            tosLink: result.tosLink,
            isApproved:
              result.isApproved === true || result.kycStatus === 'approved',
          };
        }

        if (currentStatus?.isApproved) {
          const provisioned = await provisionCurrencies(input.currencies);
          return { action: 'provisioned', currencies: provisioned };
        }

        return {
          action: 'redirect',
          tosLink: currentStatus?.tosLink ?? null,
          kycLink: currentStatus?.kycLink ?? null,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to open space account';
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [provisionCurrencies, refresh, requestOnboarding, status],
  );

  return {
    submit,
    isSubmitting,
    error,
    clearError,
    status,
    refreshStatus,
  };
};
