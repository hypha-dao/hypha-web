'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useIsDelegate,
  useMe,
  useSpaceBySlug,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { useAuthentication } from '@hypha-platform/authentication';

import { useSpaceMember } from '../../spaces';
import {
  useBankCustomerStatus,
  useBankTransfers,
  useCreateTransfer,
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
import { BankAccountsSection } from './bank-accounts-section';
import { BankTransfersSection } from './bank-transfers-section';
import { BankingAdvancedDialog } from './banking-advanced-dialog';
import { AddBankCurrencyDialog } from './add-bank-currency-dialog';
import { CreateTransferDialog } from './create-transfer-dialog';
import { BankingInitialSetup } from './banking-initial-setup';
import { BankingPageSkeleton } from './banking-page-skeleton';
import { BankingProviderStatusPanel } from './banking-provider-status-panel';
import { openBankVerificationFlowLink } from '../open-bank-verification-tos';

type BankingSectionProps = {
  spaceSlug: string;
  web3SpaceId?: number;
};

export const BankingSection: FC<BankingSectionProps> = ({
  spaceSlug,
  web3SpaceId,
}) => {
  const t = useTranslations('BankingTab');
  const tCommon = useTranslations('Common');
  const tNotStarted = useTranslations('BankingTab.notStarted');
  const { isAuthenticated } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const { person } = useMe();
  const {
    status,
    isLoading: isStatusLoading,
    isRefreshing: isStatusRefreshing,
    refresh,
  } = useBankCustomerStatus({ spaceSlug });

  const hasCustomer = status != null;
  const showBankingListings =
    hasCustomer && hasApprovedBankCurrencies(status);

  const {
    accounts: virtualAccounts,
    isLoading: virtualAccountsLoading,
    refresh: refreshVirtualAccounts,
  } = useVirtualAccounts({
    spaceSlug,
    enabled: isAuthenticated && showBankingListings,
  });
  const {
    transfers,
    isLoading: transfersLoading,
    refresh: refreshTransfers,
  } = useBankTransfers({
    spaceSlug,
    enabled: isAuthenticated && showBankingListings,
  });

  const {
    requestOnboarding,
    isSubmitting: isOnboarding,
    error: onboardingError,
    clearError: clearOnboardingError,
  } = useRequestBankOnboarding({ spaceSlug });

  const {
    createTransfer,
    isCreating: isCreatingTransfer,
    error: createTransferError,
    clearError: clearCreateTransferError,
  } = useCreateTransfer({ spaceSlug });

  const {
    createAccount,
    creatingCurrency,
    error: createAccountError,
    clearError: clearCreateAccountError,
  } = useProvisionVirtualAccount({ spaceSlug });

  const [gearOpen, setGearOpen] = useState(false);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [addCurrencyDialogOpen, setAddCurrencyDialogOpen] = useState(false);

  const needsProviderStatusRefresh =
    hasCustomer && status != null && !status.approvalRegistered;

  const refreshBankingState = useCallback(async () => {
    const updated = await refresh();
    if (hasApprovedBankCurrencies(updated)) {
      void refreshVirtualAccounts();
      void refreshTransfers();
    }
    return updated;
  }, [refresh, refreshTransfers, refreshVirtualAccounts]);

  const handleGearOpenChange = useCallback(
    (open: boolean) => {
      setGearOpen(open);
      if (open && needsProviderStatusRefresh) {
        void refreshBankingState();
      }
    },
    [needsProviderStatusRefresh, refreshBankingState],
  );

  const resolvedWeb3SpaceId =
    web3SpaceId ??
    (space?.web3SpaceId != null && canConvertToBigInt(space.web3SpaceId)
      ? Number(space.web3SpaceId)
      : undefined);

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: resolvedWeb3SpaceId,
  });
  const { isMember } = useSpaceMember({ spaceId: resolvedWeb3SpaceId });
  const { isDelegate } = useIsDelegate({ spaceId: resolvedWeb3SpaceId });

  const hasOnChainSpace = resolvedWeb3SpaceId != null;
  const hasTreasuryAddress = Boolean(spaceDetails?.executor);
  const canManage =
    isAuthenticated &&
    (isMember || isDelegate) &&
    hasOnChainSpace &&
    hasTreasuryAddress;

  const blockerMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : !hasOnChainSpace
    ? t('blockers.notOnChain')
    : !hasTreasuryAddress
    ? t('blockers.noTreasury')
    : null;

  useEffect(() => {
    if (showBankingListings) {
      void refreshVirtualAccounts();
      void refreshTransfers();
    }
  }, [
    showBankingListings,
    refreshTransfers,
    refreshVirtualAccounts,
  ]);

  const verificationInProgress = isBankVerificationInProgress(status);

  const openVerificationGear = useCallback(() => {
    setGearOpen(true);
    if (needsProviderStatusRefresh) {
      void refreshBankingState();
    }
  }, [needsProviderStatusRefresh, refreshBankingState]);

  const fallbackLegalName = space?.title?.trim() ?? '';
  const fallbackContactEmail = person?.email?.trim() ?? '';

  const canAddAccount = hasAddAccountRailAvailable(status, virtualAccounts);

  const isListsLoading =
    showBankingListings && (virtualAccountsLoading || transfersLoading);

  const openSpaceAccountDisabled = verificationInProgress || !canAddAccount;

  const openSpaceAccountDisabledReason = verificationInProgress
    ? 'finishVerificationFirst'
    : !canAddAccount
    ? 'allCurrenciesCovered'
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

  if (!isAuthenticated) {
    return (
      <p className="text-2 text-muted-foreground">{tCommon('signIn')}</p>
    );
  }

  if (isStatusLoading) {
    return <BankingPageSkeleton />;
  }

  if (!hasCustomer) {
    if (!canManage) {
      return (
        <p className="text-2 text-muted-foreground">
          {blockerMessage ?? tNotStarted('description')}
        </p>
      );
    }

    return (
      <BankingInitialSetup
        initialLegalName={fallbackLegalName}
        initialContactEmail={fallbackContactEmail}
        isSubmitting={isOnboarding}
        error={onboardingError}
        onSubmit={handleInitialSetupSubmit}
      />
    );
  }

  if (!showBankingListings) {
    if (!canManage && blockerMessage) {
      return (
        <p className="text-2 text-muted-foreground">{blockerMessage}</p>
      );
    }

    return (
      <BankingProviderStatusPanel
        spaceSlug={spaceSlug}
        status={status}
        isLoading={false}
        isRefreshing={false}
        canManage={canManage}
        blockerMessage={blockerMessage}
        onRefreshStatus={refreshBankingState}
        showPageHeader
      />
    );
  }

  if (isListsLoading) {
    return <BankingPageSkeleton />;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <BankAccountsSection
        isAuthenticated={isAuthenticated}
        canManage={canManage}
        openSpaceAccountDisabled={openSpaceAccountDisabled}
        openSpaceAccountDisabledReason={openSpaceAccountDisabledReason}
        gearSlot={
          <BankingAdvancedDialog
            spaceSlug={spaceSlug}
            status={status}
            isLoading={false}
            isRefreshing={false}
            canManage={canManage}
            blockerMessage={blockerMessage}
            open={gearOpen}
            onOpenChange={handleGearOpenChange}
            onRefreshStatus={refreshBankingState}
          />
        }
        onOpenSpaceAccount={() => {
          clearCreateAccountError();
          setAddCurrencyDialogOpen(true);
        }}
        hideListLoadingState
        depositsProps={{
          virtualAccounts,
          virtualAccountsLoading: false,
          canManage,
          hideLoadingState: true,
        }}
      />

      <BankTransfersSection
        transfers={transfers}
        transfersLoading={false}
        hasBankCustomer
        canManage={canManage}
        newTransferDisabled={verificationInProgress}
        newTransferDisabledReason={
          verificationInProgress ? 'finishVerificationFirst' : null
        }
        hideListLoadingState
        onNewTransfer={() => {
          clearCreateTransferError();
          setCreateTransferOpen(true);
        }}
      />

      <CreateTransferDialog
        open={createTransferOpen}
        onOpenChange={setCreateTransferOpen}
        spaceSlug={spaceSlug}
        status={status}
        isSubmitting={isCreatingTransfer}
        error={createTransferError}
        onOpenGear={openVerificationGear}
        onRefreshStatus={refreshBankingState}
        onSubmit={async (input) => {
          try {
            await createTransfer(input);
            setCreateTransferOpen(false);
            void refreshTransfers();
            void refresh();
          } catch (err) {
            if (
              err instanceof Error &&
              err.message.includes('verification')
            ) {
              openVerificationGear();
            }
            throw err;
          }
        }}
      />

      <AddBankCurrencyDialog
        open={addCurrencyDialogOpen}
        onOpenChange={setAddCurrencyDialogOpen}
        spaceSlug={spaceSlug}
        status={status}
        existingAccounts={virtualAccounts}
        submittingCurrency={creatingCurrency}
        error={createAccountError}
        onOpenGear={openVerificationGear}
        onRefreshStatus={refreshBankingState}
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
    </div>
  );
};
