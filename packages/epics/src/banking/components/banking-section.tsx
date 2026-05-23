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
  useProvisionVirtualAccount,
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
import { AddBankCurrencyDialog } from './add-bank-currency-dialog';
import { CreateTransferDialog } from './create-transfer-dialog';
import {
  OpenSpaceAccountDialog,
  type OpenSpaceAccountDialogMode,
} from './open-space-account-dialog';
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
  const {
    createAccount,
    creatingCurrency,
    error: createAccountError,
    clearError: clearCreateAccountError,
  } = useProvisionVirtualAccount({ spaceSlug });
  const {
    activateTransfer,
    activatingTransferId,
    failedTransferId: failedActivateTransferId,
    error: activateTransferError,
    clearError: clearActivateTransferError,
  } = useActivateTransfer({ spaceSlug });
  const {
    activateAccount,
    activatingAccountId,
    failedAccountId: failedActivateAccountId,
    error: activateAccountError,
    clearError: clearActivateAccountError,
  } = useActivateVirtualAccount({ spaceSlug });

  const [gearOpen, setGearOpen] = useState(false);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [addCurrencyDialogOpen, setAddCurrencyDialogOpen] = useState(false);
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

  const customerApproved = Boolean(
    status?.approvalRegistered || status?.isApproved,
  );

  const openSpaceAccountAvailabilityKnown =
    !isLoading && (!hasCustomer || !virtualAccountsLoading);

  const openSpaceAccountDisabled =
    !openSpaceAccountAvailabilityKnown ||
    verificationInProgress ||
    availableCurrencyCodes.length === 0;

  const openSpaceAccountDisabledReason = !openSpaceAccountAvailabilityKnown
    ? 'loadingAccounts'
    : verificationInProgress
    ? 'finishVerificationFirst'
    : availableCurrencyCodes.length === 0
    ? 'allCurrenciesCovered'
    : null;

  const handleOpenSpaceAccount = useCallback(() => {
    if (customerApproved) {
      clearCreateAccountError();
      setAddCurrencyDialogOpen(true);
      return;
    }
    clearSpaceAccountError();
    setOpenDialogMode(hasCustomer ? 'addCurrency' : 'full');
    setOpenDialogOpen(true);
  }, [
    clearCreateAccountError,
    clearSpaceAccountError,
    customerApproved,
    hasCustomer,
  ]);

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

      <BankAccountsSection
        isAuthenticated={isAuthenticated}
        canManage={canManage}
        openSpaceAccountDisabled={openSpaceAccountDisabled}
        openSpaceAccountDisabledReason={openSpaceAccountDisabledReason}
        onOpenSpaceAccount={handleOpenSpaceAccount}
        depositsProps={{
          virtualAccounts: hasCustomer ? displayVirtualAccounts : [],
          virtualAccountsLoading: hasCustomer && virtualAccountsLoading,
          canManage,
          activatingAccountId,
          failedAccountId: failedActivateAccountId,
          activateError: activateAccountError,
          provisionError: spaceAccountError,
          onOpenVerificationDetails: openVerificationGear,
          onActivateAccount: (id) => {
            clearActivateAccountError();
            void activateAccount(id)
              .then(() => void refreshVirtualAccounts())
              .catch(() => undefined);
          },
        }}
      />

      <BankTransfersSection
        transfers={hasCustomer ? displayTransfers : []}
        transfersLoading={hasCustomer && transfersLoading}
        canManage={canManage}
        activatingTransferId={activatingTransferId}
        failedTransferId={failedActivateTransferId}
        activateError={activateTransferError}
        onOpenVerificationDetails={openVerificationGear}
        onActivateTransfer={(id) => {
          clearActivateTransferError();
          void activateTransfer(id)
            .then(() => void refreshTransfers())
            .catch(() => undefined);
        }}
        onNewTransfer={
          canManage
            ? () => {
                clearCreateTransferError();
                setCreateTransferOpen(true);
              }
            : undefined
        }
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
          openBankVerificationFlowLink(updated);
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
          openBankVerificationFlowLink(updated);
          void refreshVirtualAccounts();
        }}
      />

      <AddBankCurrencyDialog
        open={addCurrencyDialogOpen}
        onOpenChange={setAddCurrencyDialogOpen}
        legalName={customerLegalName}
        contactEmail={customerContactEmail}
        availableCurrencies={availableCurrencyCodes}
        submittingCurrency={creatingCurrency}
        error={createAccountError}
        onAddCurrency={async (currency) => {
          clearCreateAccountError();
          try {
            const result = await createAccount(currency);
            setAddCurrencyDialogOpen(false);
            const updated = await refresh();
            if (result.action === 'kyc_required') {
              openBankVerificationFlowLink({
                tosLink: result.tosLink,
                kycLink: result.kycLink,
              }) || openBankVerificationFlowLink(updated ?? undefined);
            }
            void refreshVirtualAccounts();
          } catch {
            // Error state is handled by the hook; keep the dialog open.
          }
        }}
      />
    </div>
  );
};
