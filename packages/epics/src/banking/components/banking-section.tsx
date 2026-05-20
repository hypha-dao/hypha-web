'use client';

import { FC, ReactNode, useCallback, useEffect, useState } from 'react';
import { ExternalLink, Landmark, Loader2 } from 'lucide-react';
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
import { BANK_KYC_STATUSES, type BankKycStatus, useBankCustomerStatus } from '../hooks';
import { BankOnboardingDialog } from './bank-onboarding-dialog';

type BankingSectionProps = {
  spaceSlug: string;
  web3SpaceId?: number;
  variant?: 'default' | 'return';
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
  variant = 'default',
}) => {
  const t = useTranslations('BankingTab');
  const tCommon = useTranslations('Common');
  const { isAuthenticated } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const { status, isLoading, error, refresh } = useBankCustomerStatus({
    spaceSlug,
  });
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
    isAuthenticated && (isMember || isDelegate) && hasOnChainSpace && hasTreasuryAddress;

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
    if (variant === 'return') {
      void refresh();
    }
  }, [variant, refresh]);

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
            <Button colorVariant="accent" className="w-fit" disabled title={blockerMessage ?? ''}>
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
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
            <Text size="2" weight="medium" className="block mb-1">
              {t('status.approved.depositPlaceholderTitle')}
            </Text>
            <Text size="2" className="text-muted-foreground">
              {t('status.approved.depositPlaceholderDescription')}
            </Text>
          </div>
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
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
            {tosLink ? (
              <TosLink href={tosLink} label={t('actions.viewTerms')} />
            ) : null}
          </>
        }
      />
    );
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {variant === 'return' ? (
        <div className="rounded-lg border border-accent-6 bg-accent-2 px-4 py-3">
          <Text size="2">{t('returnBanner')}</Text>
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <Landmark className="mt-1 h-6 w-6 shrink-0 text-accent-9" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text size="5" weight="medium">
            {t('title')}
          </Text>
          <Text size="2" className="text-muted-foreground">
            {t('subtitle')}
          </Text>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-destructive">{t('errorLoad')}</p>
          <Button variant="outline" className="w-fit" onClick={() => void refresh()}>
            {t('actions.refreshStatus')}
          </Button>
        </div>
      ) : null}

      {blockerMessage && status == null && !isLoading && isAuthenticated ? (
        <p className="text-sm text-muted-foreground">{blockerMessage}</p>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4">{renderStatusBody()}</div>

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
      <Text size="3" weight="medium">
        {title}
      </Text>
      <Text size="2" className="text-muted-foreground">
        {description}
      </Text>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function TosLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="outline" className="w-fit" asChild>
      <Link href={href} target="_blank" rel="noopener noreferrer">
        {label}
        <ExternalLink className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  );
}
