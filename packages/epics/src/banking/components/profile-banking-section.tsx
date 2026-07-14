'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMe } from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';

import {
  useBankCustomerStatus,
  useCreatePayoutAccount,
  usePayoutAccounts,
  useRequestBankOnboarding,
} from '../hooks';
import {
  hasApprovedBankCurrencies,
  isBankVerificationInProgress,
} from '../banking-ui';
import type { BankCurrencyCode } from '../bank-currency-display';
import type { BankPayoutAccountPublic } from '../hooks/types';
import { AddPayoutAccountDialog } from './add-payout-account-dialog';
import { ApprovedBankingPayouts } from './approved-banking-payouts';
import { BankingAdvancedDialog } from './banking-advanced-dialog';
import { BankingInitialSetup } from './banking-initial-setup';
import { BankingPageSkeleton } from './banking-page-skeleton';
import { BankingProviderStatusPanel } from './banking-provider-status-panel';
import { PayoutAccountDetailDialog } from './payout-account-detail-dialog';
import { openBankVerificationFlowLink } from '../open-bank-verification-tos';

type ProfileBankingSectionProps = {
  personSlug: string;
  /** Whether the current user owns this profile — gates all management actions. */
  isMyProfile: boolean;
};

/**
 * Payouts-only banking for a member profile (individual off-ramp). Reuses the
 * space banking building blocks through the owner-agnostic `basePath`; there are
 * no deposits, transfers, or advanced dialog here (transfers reuse the existing
 * Profile → Actions → Transfer funds flow).
 */
export const ProfileBankingSection: FC<ProfileBankingSectionProps> = ({
  personSlug,
  isMyProfile,
}) => {
  const t = useTranslations('BankingTab');
  const tCommon = useTranslations('Common');
  const tNotStarted = useTranslations('BankingTab.notStarted');
  const tPayouts = useTranslations('BankingTab.payouts');
  const tToolbar = useTranslations('BankingTab.toolbar');
  const { isAuthenticated } = useAuthentication();
  const { person } = useMe();

  const basePath = useMemo(
    () => `/api/v1/people/${personSlug}/banking`,
    [personSlug],
  );

  const {
    status,
    isError: isStatusError,
    isLoading: isStatusLoading,
    isRefreshing: isStatusRefreshing,
    refresh,
  } = useBankCustomerStatus({ basePath });

  const hasCustomer = status != null;
  const showBankingListings = hasCustomer && hasApprovedBankCurrencies(status);
  const canManage = isAuthenticated && isMyProfile;

  const {
    accounts: payoutAccounts,
    isLoading: payoutAccountsLoading,
    refresh: refreshPayoutAccounts,
  } = usePayoutAccounts({
    basePath,
    enabled: isAuthenticated && isMyProfile && showBankingListings,
  });

  const {
    requestOnboarding,
    isSubmitting: isOnboarding,
    error: onboardingError,
    clearError: clearOnboardingError,
  } = useRequestBankOnboarding({ basePath });

  const {
    createPayoutAccount,
    isCreating: isCreatingPayoutAccount,
    error: createPayoutAccountError,
    clearError: clearCreatePayoutAccountError,
  } = useCreatePayoutAccount({ basePath });

  const [addPayoutDialogOpen, setAddPayoutDialogOpen] = useState(false);
  const [detailAccount, setDetailAccount] =
    useState<BankPayoutAccountPublic | null>(null);
  const [advancedDialogOpen, setAdvancedDialogOpen] = useState(false);

  const refreshBankingState = useCallback(async () => {
    const updated = await refresh();
    if (hasApprovedBankCurrencies(updated)) {
      void refreshPayoutAccounts();
    }
    return updated;
  }, [refresh, refreshPayoutAccounts]);

  const needsProviderStatusRefresh =
    hasCustomer && status != null && !status.approvalRegistered;

  const handleAdvancedDialogOpenChange = useCallback(
    (open: boolean) => {
      setAdvancedDialogOpen(open);
      if (open && needsProviderStatusRefresh) {
        void refreshBankingState();
      }
    },
    [needsProviderStatusRefresh, refreshBankingState],
  );

  const fallbackLegalName = useMemo(() => {
    const parts = [person?.name, person?.surname].filter(Boolean);
    return parts.join(' ').trim();
  }, [person?.name, person?.surname]);
  const fallbackContactEmail = person?.email?.trim() ?? '';

  const verificationInProgress = isBankVerificationInProgress(status);
  const openPayoutAccountDisabled = verificationInProgress;

  const blockerMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMyProfile
    ? tNotStarted('person.description')
    : null;

  const handleInitialSetupSubmit = useCallback(
    async (input: {
      legalName: string;
      contactEmail: string;
      currencies: BankCurrencyCode[];
    }) => {
      clearOnboardingError();
      await requestOnboarding({
        legalName: input.legalName,
        contactEmail: input.contactEmail,
        requestedRails: input.currencies,
      });
      const updated = await refresh();
      openBankVerificationFlowLink(updated ?? undefined);
    },
    [clearOnboardingError, refresh, requestOnboarding],
  );

  if (isStatusLoading) {
    return <BankingPageSkeleton />;
  }

  if (isStatusError) {
    return (
      <p className="text-2 text-muted-foreground">{t('errorFetchStatus')}</p>
    );
  }

  if (!hasCustomer) {
    if (!canManage) {
      return (
        <p className="text-2 text-muted-foreground">
          {blockerMessage ?? tNotStarted('person.description')}
        </p>
      );
    }

    return (
      <BankingInitialSetup
        initialLegalName={fallbackLegalName}
        initialContactEmail={fallbackContactEmail}
        isSubmitting={isOnboarding}
        error={onboardingError}
        ownerContext="person"
        onSubmit={handleInitialSetupSubmit}
      />
    );
  }

  if (!showBankingListings) {
    if (!canManage && blockerMessage) {
      return <p className="text-2 text-muted-foreground">{blockerMessage}</p>;
    }

    return (
      <BankingProviderStatusPanel
        basePath={basePath}
        status={status}
        isLoading={false}
        isRefreshing={isStatusRefreshing}
        canManage={canManage}
        blockerMessage={blockerMessage}
        onRefreshStatus={refreshBankingState}
        showPageHeader
        ownerContext="person"
      />
    );
  }

  const addButton = (
    <Button
      type="button"
      colorVariant="accent"
      variant="outline"
      className="shrink-0"
      disabled={!canManage || openPayoutAccountDisabled}
      onClick={
        !canManage || openPayoutAccountDisabled
          ? undefined
          : () => {
              clearCreatePayoutAccountError();
              setAddPayoutDialogOpen(true);
            }
      }
    >
      {tPayouts('addCta')}
    </Button>
  );

  return (
    <div className="flex w-full flex-col gap-2">
      {canManage ? (
        <div className="flex justify-end">
          <BankingAdvancedDialog
            basePath={basePath}
            ownerContext="person"
            status={status}
            isLoading={false}
            isRefreshing={isStatusRefreshing}
            canManage={canManage}
            blockerMessage={blockerMessage}
            open={advancedDialogOpen}
            onOpenChange={handleAdvancedDialogOpenChange}
            onRefreshStatus={refreshBankingState}
          />
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="text-3 font-semibold tracking-tight text-foreground">
              {tPayouts('section.title')}
            </h4>
            <p className="mt-1 max-w-3xl text-2 text-muted-foreground">
              {tPayouts('section.person.description')}
            </p>
          </div>
          {canManage ? (
            <div className="flex shrink-0 items-center">
              {openPayoutAccountDisabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex shrink-0">{addButton}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {tToolbar('finishVerificationFirst')}
                  </TooltipContent>
                </Tooltip>
              ) : (
                addButton
              )}
            </div>
          ) : null}
        </div>

        <ApprovedBankingPayouts
          payoutAccounts={payoutAccounts}
          payoutAccountsLoading={payoutAccountsLoading}
          onCardClick={(account) => setDetailAccount(account)}
        />
      </section>

      <AddPayoutAccountDialog
        open={addPayoutDialogOpen}
        onOpenChange={setAddPayoutDialogOpen}
        isSubmitting={isCreatingPayoutAccount}
        error={createPayoutAccountError}
        defaultAccountOwnerName={fallbackLegalName}
        defaultBusinessName={fallbackLegalName}
        status={status}
        ownerContext="person"
        onSubmit={async (input) => {
          clearCreatePayoutAccountError();
          const result = await createPayoutAccount(input);
          void refreshPayoutAccounts();
          return result.account;
        }}
        onSuccess={(account) => {
          setAddPayoutDialogOpen(false);
          setDetailAccount(account);
        }}
      />

      <PayoutAccountDetailDialog
        open={detailAccount != null}
        account={detailAccount}
        ownerContext="person"
        onOpenChange={(open) => {
          if (!open) setDetailAccount(null);
        }}
      />
    </div>
  );
};
