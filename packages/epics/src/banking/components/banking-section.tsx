'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useIsDelegate,
  useMe,
  useSpaceBySlug,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { useAuthentication } from '@hypha-platform/authentication';

import { useSpaceMember } from '../../spaces';
import {
  useActivateTransfer,
  useActivateVirtualAccount,
  useBankCustomerStatus,
  useCreateTransfer,
  useRequestSpaceAccount,
  useTransfers,
  useVirtualAccounts,
} from '../hooks';
import {
  enrichTransferWithCustomerStatus,
  enrichVirtualAccountWithCustomerStatus,
  getAvailableBankCurrencyCodes,
  isBankVerificationInProgress,
  isCustomerReadyForBankOperations,
} from '../banking-ui';
import { BankAccountsSection } from './bank-accounts-section';
import { BankTransfersSection } from './bank-transfers-section';
import { BankingToolbar } from './banking-toolbar';
import { CreateTransferDialog } from './create-transfer-dialog';
import {
  OpenSpaceAccountDialog,
  type OpenSpaceAccountDialogMode,
} from './open-space-account-dialog';
import { openBankVerificationTosLink } from '../open-bank-verification-tos';

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
  const { isAuthenticated } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const { person } = useMe();
  const { status, isLoading, isRefreshing, error, refresh } =
    useBankCustomerStatus({ spaceSlug });

  const hasCustomer = status != null;

  const {
    accounts: virtualAccounts,
    isLoading: virtualAccountsLoading,
    refresh: refreshVirtualAccounts,
  } = useVirtualAccounts({
    spaceSlug,
    enabled: isAuthenticated && hasCustomer,
  });
  const {
    transfers,
    isLoading: transfersLoading,
    refresh: refreshTransfers,
  } = useTransfers({
    spaceSlug,
    enabled: isAuthenticated && hasCustomer,
  });

  const {
    createTransfer,
    isCreating: isCreatingTransfer,
    error: createTransferError,
    clearError: clearCreateTransferError,
  } = useCreateTransfer({ spaceSlug });
  const {
    requestSpaceAccount,
    isSubmitting: isRequestingSpaceAccount,
    error: spaceAccountError,
    clearError: clearSpaceAccountError,
  } = useRequestSpaceAccount({ spaceSlug });
  const { activateTransfer, isActivating: isActivatingTransfer } =
    useActivateTransfer({ spaceSlug });
  const { activateAccount, isActivating: isActivatingAccount } =
    useActivateVirtualAccount({ spaceSlug });

  const [gearOpen, setGearOpen] = useState(false);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [openDialogMode, setOpenDialogMode] =
    useState<OpenSpaceAccountDialogMode>('full');

  const needsProviderStatusRefresh =
    hasCustomer && status != null && !status.approvalRegistered;

  const refreshBankingState = useCallback(async () => {
    const updated = await refresh();
    if (isCustomerReadyForBankOperations(updated)) {
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
    if (hasCustomer && isCustomerReadyForBankOperations(status)) {
      void refreshVirtualAccounts();
      void refreshTransfers();
    }
  }, [
    hasCustomer,
    status?.isApproved,
    status?.approvalRegistered,
    status?.procedures.tos.isComplete,
    status?.procedures.kyc.isComplete,
    refreshTransfers,
    refreshVirtualAccounts,
  ]);

  const displayVirtualAccounts = useMemo(
    () =>
      virtualAccounts.map((account) =>
        enrichVirtualAccountWithCustomerStatus(account, status),
      ),
    [status, virtualAccounts],
  );

  const displayTransfers = useMemo(
    () =>
      transfers.map((transfer) =>
        enrichTransferWithCustomerStatus(transfer, status),
      ),
    [status, transfers],
  );

  const verificationInProgress = isBankVerificationInProgress(status);

  const openVerificationGear = useCallback(() => {
    setGearOpen(true);
    if (needsProviderStatusRefresh) {
      void refreshBankingState();
    }
  }, [needsProviderStatusRefresh, refreshBankingState]);

  const fallbackLegalName = space?.title?.trim() ?? '';
  const fallbackContactEmail = person?.email?.trim() ?? '';
  const customerLegalName = status?.name?.trim() || fallbackLegalName;
  const customerContactEmail =
    status?.contactEmail?.trim() || fallbackContactEmail;
  const customerFieldsLocked = hasCustomer;

  const availableCurrencyCodes = useMemo(
    () => getAvailableBankCurrencyCodes(hasCustomer ? virtualAccounts : []),
    [hasCustomer, virtualAccounts],
  );

  const openSpaceAccountDisabled =
    verificationInProgress || availableCurrencyCodes.length === 0;
  const openSpaceAccountDisabledReason = verificationInProgress
    ? 'finishVerificationFirst'
    : availableCurrencyCodes.length === 0
    ? 'allCurrenciesCovered'
    : null;

  return (
    <div className="flex w-full flex-col gap-8">
      <BankingToolbar
        spaceSlug={spaceSlug}
        status={status}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        canManage={canManage}
        blockerMessage={blockerMessage}
        gearOpen={gearOpen}
        onGearOpenChange={handleGearOpenChange}
        onRefreshStatus={refreshBankingState}
      />

      {error ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{t('errorLoad')}</p>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => void refresh()}
          >
            {t('actions.refreshStatus')}
          </Button>
        </div>
      ) : null}

      {blockerMessage && !canManage && isAuthenticated ? (
        <p className="text-sm text-muted-foreground">{blockerMessage}</p>
      ) : null}

      <BankTransfersSection
        transfers={hasCustomer ? displayTransfers : []}
        transfersLoading={hasCustomer && transfersLoading}
        canManage={canManage}
        isActivating={isActivatingTransfer}
        onOpenVerificationDetails={openVerificationGear}
        onActivateTransfer={(id) => {
          void activateTransfer(id).then(() => void refreshTransfers());
        }}
        onNewPaymentLink={
          canManage
            ? () => {
                clearCreateTransferError();
                setCreateTransferOpen(true);
              }
            : undefined
        }
      />

      <BankAccountsSection
        isAuthenticated={isAuthenticated}
        canManage={canManage}
        openSpaceAccountDisabled={openSpaceAccountDisabled}
        openSpaceAccountDisabledReason={openSpaceAccountDisabledReason}
        onOpenSpaceAccount={
          canManage
            ? () => {
                clearSpaceAccountError();
                setOpenDialogMode(hasCustomer ? 'addCurrency' : 'full');
                setOpenDialogOpen(true);
              }
            : undefined
        }
        depositsProps={{
          virtualAccounts: hasCustomer ? displayVirtualAccounts : [],
          virtualAccountsLoading: hasCustomer && virtualAccountsLoading,
          canManage,
          isActivating: isActivatingAccount,
          provisionError: spaceAccountError,
          onOpenVerificationDetails: openVerificationGear,
          onActivateAccount: (id) => {
            void activateAccount(id).then(() => void refreshVirtualAccounts());
          },
        }}
      />

      <CreateTransferDialog
        open={createTransferOpen}
        onOpenChange={setCreateTransferOpen}
        customerFieldsLocked={customerFieldsLocked}
        initialLegalName={customerLegalName}
        initialContactEmail={customerContactEmail}
        isSubmitting={isCreatingTransfer}
        error={createTransferError}
        onSubmit={async (input) => {
          await createTransfer(input);
          setCreateTransferOpen(false);
          const updated = await refresh();
          openBankVerificationTosLink(updated);
          void refreshTransfers();
        }}
      />

      <OpenSpaceAccountDialog
        open={openDialogOpen}
        onOpenChange={setOpenDialogOpen}
        mode={openDialogMode}
        customerFieldsLocked={customerFieldsLocked}
        availableCurrencies={availableCurrencyCodes}
        initialLegalName={customerLegalName}
        initialContactEmail={customerContactEmail}
        isSubmitting={isRequestingSpaceAccount}
        error={spaceAccountError}
        onSubmit={async (input) => {
          clearSpaceAccountError();
          await requestSpaceAccount({
            legalName: input.legalName,
            contactEmail: input.contactEmail,
            currencies: input.currencies,
          });
          setOpenDialogOpen(false);
          const updated = await refresh();
          openBankVerificationTosLink(updated);
          void refreshVirtualAccounts();
        }}
      />
    </div>
  );
};
