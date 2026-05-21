'use client';

import { FC, ReactNode, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Text } from '@radix-ui/themes';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  useIsDelegate,
  useSpaceBySlug,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

import { useSpaceMember } from '../../spaces';
import {
  BANK_KYC_STATUSES,
  type BankKycStatus,
  type BankVirtualAccountCurrency,
  useBankCustomerStatus,
  useProvisionVirtualAccount,
  useVirtualAccounts,
} from '../hooks';
import { ApprovedBankingDeposits } from './approved-banking-deposits';
import { BankOnboardingDialog } from './bank-onboarding-dialog';
import { BankingSandboxDemoBar } from './banking-sandbox-demo-bar';

type BankingSectionProps = {
  spaceSlug: string;
  web3SpaceId?: number;
};

function openVerificationLink(url: string | null | undefined) {
  if (!url) {
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function getKycStatusLabel(
  kycStatus: string,
  t: ReturnType<typeof useTranslations<'BankingTab'>>,
): string {
  if ((BANK_KYC_STATUSES as readonly string[]).includes(kycStatus)) {
    return t(`status.${kycStatus as BankKycStatus}.title`);
  }
  return kycStatus;
}

export const BankingSection: FC<BankingSectionProps> = ({
  spaceSlug,
  web3SpaceId,
}) => {
  const t = useTranslations('BankingTab');
  const tCommon = useTranslations('Common');
  const { isAuthenticated } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const { status, isLoading, isRefreshing, error, refresh } =
    useBankCustomerStatus({
      spaceSlug,
    });
  const {
    accounts: virtualAccounts,
    isLoading: virtualAccountsLoading,
    refresh: refreshVirtualAccounts,
  } = useVirtualAccounts({
    spaceSlug,
    enabled: Boolean(status?.isApproved),
  });
  const {
    provisionAccount,
    isProvisioning,
    provisioningCurrency,
    error: provisionError,
    clearError: clearProvisionError,
  } = useProvisionVirtualAccount({ spaceSlug });
  const [dialogOpen, setDialogOpen] = useState(false);

  const resolvedWeb3SpaceId =
    web3SpaceId ??
    (space?.web3SpaceId != null && canConvertToBigInt(space.web3SpaceId)
      ? Number(space.web3SpaceId)
      : undefined);

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: resolvedWeb3SpaceId,
  });
  const { isMember } = useSpaceMember({
    spaceId: resolvedWeb3SpaceId,
  });
  const { isDelegate } = useIsDelegate({
    spaceId: resolvedWeb3SpaceId,
  });

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

  const handleRefreshStatus = useCallback(() => {
    void refresh();
  }, [refresh]);

  const handleOnboardingSuccess = useCallback(
    (result: {
      kycLink: string | null;
      kycStatus: string;
      isApproved?: boolean;
    }) => {
      void refresh();
      if (!result.isApproved && result.kycStatus !== 'approved') {
        openVerificationLink(result.kycLink);
      }
    },
    [refresh],
  );

  const handleProvision = useCallback(
    (currency: BankVirtualAccountCurrency) => {
      clearProvisionError();
      void provisionAccount(currency)
        .then(() => {
          void refreshVirtualAccounts();
          void refresh();
        })
        .catch(() => undefined);
    },
    [clearProvisionError, provisionAccount, refresh, refreshVirtualAccounts],
  );

  const renderStatusBody = () => {
    if (!isAuthenticated) {
      return (
        <Text size="2" className="text-muted-foreground">
          {tCommon('signIn')}
        </Text>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <Text size="2">{t('loading')}</Text>
        </div>
      );
    }

    if (status == null) {
      return (
        <div className="flex flex-col gap-4">
          <Text size="2" className="text-muted-foreground">
            {t('notStarted.description')}
          </Text>
          {canManage ? (
            <Button
              colorVariant="accent"
              className="w-fit"
              onClick={() => setDialogOpen(true)}
            >
              {t('notStarted.enableCta')}
            </Button>
          ) : (
            <Button
              colorVariant="accent"
              className="w-fit"
              disabled
              title={blockerMessage ?? ''}
            >
              {t('notStarted.enableCta')}
            </Button>
          )}
        </div>
      );
    }

    if (status.isApproved) {
      return (
        <div className="flex flex-col gap-4">
          <StatusPanel
            title={t('status.approved.title')}
            description={t('status.approved.description')}
          />
          <ApprovedBankingDeposits
            virtualAccounts={virtualAccounts}
            virtualAccountsLoading={virtualAccountsLoading}
            canManage={canManage}
            isProvisioning={isProvisioning}
            provisioningCurrency={provisioningCurrency}
            provisionError={provisionError}
            onProvision={handleProvision}
          />
        </div>
      );
    }

    const kycLink = status.kycLink;
    const tosLink = status.tosLink;

    return (
      <StatusPanel
        title={getKycStatusLabel(status.kycStatus, t)}
        description={t('verificationInProgress')}
        actions={
          <>
            {kycLink ? (
              <Button
                colorVariant="accent"
                className="w-fit"
                onClick={() => openVerificationLink(kycLink)}
              >
                {t('actions.openVerificationForm')}
              </Button>
            ) : null}
            {tosLink ? (
              <TosLink href={tosLink} label={t('actions.viewTerms')} />
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={isRefreshing}
              onClick={handleRefreshStatus}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('actions.refreshingStatus')}
                </>
              ) : (
                t('actions.refreshStatus')
              )}
            </Button>
          </>
        }
      />
    );
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="w-full">
        <h3 className="text-4 font-semibold tracking-tight text-foreground">
          {t('title')}
        </h3>
        <p className="mt-1 max-w-3xl text-2 text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

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

      {blockerMessage && status == null && !isLoading && isAuthenticated ? (
        <p className="text-sm text-muted-foreground">{blockerMessage}</p>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4">
        {renderStatusBody()}
      </div>

      {!isLoading && status != null && !status.isApproved ? (
        <BankingSandboxDemoBar spaceSlug={spaceSlug} canManage={canManage} />
      ) : null}

      <BankOnboardingDialog
        spaceSlug={spaceSlug}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleOnboardingSuccess}
      />
    </div>
  );
};

type StatusPanelProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

function StatusPanel({ title, description, actions }: StatusPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-3 font-semibold tracking-tight text-foreground">
        {title}
      </h4>
      <p className="text-2 text-muted-foreground">{description}</p>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function TosLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="outline" className="w-fit" asChild>
      <Link href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </Link>
    </Button>
  );
}
