'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMe } from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';

import {
  useBankCustomerStatus,
  useBankTransfers,
  useCreatePayoutAccount,
  useCreateTransfer,
  usePayoutAccounts,
  useProvisionVirtualAccount,
  useRequestBankOnboarding,
  useVirtualAccounts,
} from '../hooks';
import {
  hasAddAccountRailAvailable,
  hasApprovedBankCurrencies,
  isBankVerificationInProgress,
} from '../banking-ui';
import type { BankCurrencyCode } from '../bank-currency-display';
import type { BankPayoutAccountPublic } from '../hooks/types';
import { AddBankCurrencyDialog } from './add-bank-currency-dialog';
import { AddPayoutAccountDialog } from './add-payout-account-dialog';
import { BankAccountsSection } from './bank-accounts-section';
import { BankingAdvancedDialog } from './banking-advanced-dialog';
import { BankingInitialSetup } from './banking-initial-setup';
import { BankingPageSkeleton } from './banking-page-skeleton';
import { BankingProviderStatusPanel } from './banking-provider-status-panel';
import { CreateTransferDialog } from './create-transfer-dialog';
import { PayoutAccountDetailDialog } from './payout-account-detail-dialog';
import { openBankVerificationFlowLink } from '../open-bank-verification-tos';

type ProfileBankingSectionProps = {
  personSlug: string;
  /** Whether the current user owns this profile — gates all management actions. */
  isMyProfile: boolean;
};

/**
 * Deposits/Payouts banking for a member profile (individual on-ramp/off-ramp).
 * Reuses the space banking building blocks through the owner-agnostic
 * `basePath` + `ownerContext="person"`, same convention as the payouts-only
 * predecessor this replaces.
 */
export const ProfileBankingSection: FC<ProfileBankingSectionProps> = ({
  personSlug,
  isMyProfile,
}) => {
  const t = useTranslations('BankingTab');
  const tCommon = useTranslations('Common');
  const tNotStarted = useTranslations('BankingTab.notStarted');
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
    accounts: virtualAccounts,
    isLoading: virtualAccountsLoading,
    refresh: refreshVirtualAccounts,
  } = useVirtualAccounts({
    basePath,
    enabled: isAuthenticated && isMyProfile && showBankingListings,
  });
  const {
    accounts: payoutAccounts,
    isLoading: payoutAccountsLoading,
    refresh: refreshPayoutAccounts,
  } = usePayoutAccounts({
    basePath,
    enabled: isAuthenticated && isMyProfile && showBankingListings,
  });
  const {
    transfers,
    isLoading: transfersLoading,
    refresh: refreshTransfers,
  } = useBankTransfers({
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
    createTransfer,
    isCreating: isCreatingTransfer,
    error: createTransferError,
    clearError: clearCreateTransferError,
  } = useCreateTransfer({ basePath });

  const {
    createAccount,
    creatingCurrency,
    error: createAccountError,
    clearError: clearCreateAccountError,
  } = useProvisionVirtualAccount({ basePath });

  const {
    createPayoutAccount,
    isCreating: isCreatingPayoutAccount,
    error: createPayoutAccountError,
    clearError: clearCreatePayoutAccountError,
  } = useCreatePayoutAccount({ basePath });

  const [gearOpen, setGearOpen] = useState(false);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [addCurrencyDialogOpen, setAddCurrencyDialogOpen] = useState(false);
  const [addPayoutDialogOpen, setAddPayoutDialogOpen] = useState(false);
  const [detailAccount, setDetailAccount] =
    useState<BankPayoutAccountPublic | null>(null);

  const needsProviderStatusRefresh =
    hasCustomer && status != null && !status.approvalRegistered;

  const refreshBankingState = useCallback(async () => {
    const updated = await refresh();
    if (hasApprovedBankCurrencies(updated)) {
      void refreshVirtualAccounts();
      void refreshTransfers();
      void refreshPayoutAccounts();
    }
    return updated;
  }, [
    refresh,
    refreshPayoutAccounts,
    refreshTransfers,
    refreshVirtualAccounts,
  ]);

  const handleGearOpenChange = useCallback(
    (open: boolean) => {
      setGearOpen(open);
      if (open && needsProviderStatusRefresh) {
        void refreshBankingState();
      }
    },
    [needsProviderStatusRefresh, refreshBankingState],
  );

  const hasWalletAddress = Boolean(person?.address);
  const canManageDeposits = canManage && hasWalletAddress;

  const blockerMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMyProfile
    ? tNotStarted('person.description')
    : null;

  const verificationInProgress = isBankVerificationInProgress(status);

  const openVerificationGear = useCallback(() => {
    setGearOpen(true);
    if (needsProviderStatusRefresh) {
      void refreshBankingState();
    }
  }, [needsProviderStatusRefresh, refreshBankingState]);

  const fallbackLegalName = useMemo(() => {
    const parts = [person?.name, person?.surname].filter(Boolean);
    return parts.join(' ').trim();
  }, [person?.name, person?.surname]);
  const fallbackContactEmail = person?.email?.trim() ?? '';

  const canAddAccount = hasAddAccountRailAvailable(status, virtualAccounts);

  const openSpaceAccountDisabled =
    verificationInProgress || !canAddAccount || !hasWalletAddress;
  const openPayoutAccountDisabled = verificationInProgress;

  const openPayoutAccountDisabledReason = verificationInProgress
    ? 'finishVerificationFirst'
    : null;

  const openSpaceAccountDisabledReason = verificationInProgress
    ? 'finishVerificationFirst'
    : !hasWalletAddress
    ? 'walletAddressRequired'
    : !canAddAccount
    ? 'allCurrenciesCovered'
    : null;

  // New Transfer reaches the same wallet-address destination as the
  // permanent virtual account, so it needs the same gate.
  const newTransferDisabled = verificationInProgress || !hasWalletAddress;
  const newTransferDisabledReason = verificationInProgress
    ? 'finishVerificationFirst'
    : !hasWalletAddress
    ? 'walletAddressRequired'
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

  return (
    <div className="flex w-full flex-col gap-6">
      <BankAccountsSection
        isAuthenticated={isAuthenticated}
        canManage={canManage}
        ownerContext="person"
        openSpaceAccountDisabled={openSpaceAccountDisabled}
        openSpaceAccountDisabledReason={openSpaceAccountDisabledReason}
        gearSlot={
          canManage ? (
            <BankingAdvancedDialog
              basePath={basePath}
              ownerContext="person"
              status={status}
              isLoading={false}
              isRefreshing={false}
              canManage={canManage}
              blockerMessage={blockerMessage}
              open={gearOpen}
              onOpenChange={handleGearOpenChange}
              onRefreshStatus={refreshBankingState}
            />
          ) : undefined
        }
        onOpenSpaceAccount={() => {
          clearCreateAccountError();
          setAddCurrencyDialogOpen(true);
        }}
        onOpenPayoutAccount={() => {
          clearCreatePayoutAccountError();
          setAddPayoutDialogOpen(true);
        }}
        onPayoutAccountClick={(account) => setDetailAccount(account)}
        openPayoutAccountDisabled={openPayoutAccountDisabled}
        openPayoutAccountDisabledReason={openPayoutAccountDisabledReason}
        payoutAccounts={payoutAccounts}
        payoutAccountsLoading={payoutAccountsLoading}
        depositsProps={{
          virtualAccounts,
          virtualAccountsLoading,
          canManage: canManageDeposits,
        }}
        transfersProps={{
          transfers,
          transfersLoading,
          hasBankCustomer: true,
          canManage,
          newTransferDisabled,
          newTransferDisabledReason,
          onNewTransfer: () => {
            clearCreateTransferError();
            setCreateTransferOpen(true);
          },
        }}
      />

      <CreateTransferDialog
        open={createTransferOpen}
        onOpenChange={setCreateTransferOpen}
        spaceSlug={personSlug}
        status={status}
        isSubmitting={isCreatingTransfer}
        error={createTransferError}
        onOpenGear={openVerificationGear}
        ownerContext="person"
        onSubmit={async (input) => {
          try {
            await createTransfer(input);
            setCreateTransferOpen(false);
            void refreshTransfers();
            void refresh();
          } catch (err) {
            if (err instanceof Error && err.message.includes('verification')) {
              openVerificationGear();
            }
          }
        }}
      />

      <AddBankCurrencyDialog
        open={addCurrencyDialogOpen}
        onOpenChange={setAddCurrencyDialogOpen}
        spaceSlug={personSlug}
        status={status}
        existingAccounts={virtualAccounts}
        submittingCurrency={creatingCurrency}
        error={createAccountError}
        onOpenGear={openVerificationGear}
        ownerContext="person"
        onAddCurrency={async ({ currency, destinationCurrency }) => {
          clearCreateAccountError();
          try {
            await createAccount(currency, { destinationCurrency });
            setAddCurrencyDialogOpen(false);
            void refreshVirtualAccounts();
            void refresh();
          } catch {
            // hook sets error
          }
        }}
      />

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
