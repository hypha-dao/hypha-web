'use client';

import { FC, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';

import { Empty } from '../../common';
import {
  BANKING_LOADING_STATE_CLASS,
  TREASURY_CARD_GRID_CLASS,
} from '../banking-ui';
import type { BankTransferPublic } from '../hooks/types';
import { BankTransferCard } from './bank-transfer-card';
import { BankTransferDetailsDialog } from './bank-transfer-details-dialog';

export type BankTransfersSectionProps = {
  transfers: BankTransferPublic[];
  transfersLoading: boolean;
  canManage: boolean;
  hasBankCustomer?: boolean;
  newTransferDisabled?: boolean;
  newTransferDisabledReason?:
    | 'loadingTransfers'
    | 'finishVerificationFirst'
    | null;
  onNewTransfer?: () => void;
  hideListLoadingState?: boolean;
};

export const BankTransfersSection: FC<BankTransfersSectionProps> = ({
  transfers,
  transfersLoading,
  canManage,
  hasBankCustomer = true,
  newTransferDisabled = false,
  newTransferDisabledReason = null,
  onNewTransfer,
  hideListLoadingState = false,
}) => {
  const t = useTranslations('BankingTab.sections.transfers');
  const tNotStarted = useTranslations('BankingTab.notStarted');
  const tToolbar = useTranslations('BankingTab.toolbar');
  const [detailsTransfer, setDetailsTransfer] =
    useState<BankTransferPublic | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const openDetails = (transfer: BankTransferPublic) => {
    setDetailsTransfer(transfer);
    setDetailsOpen(true);
  };

  const tooltipText =
    newTransferDisabledReason === 'loadingTransfers'
      ? tToolbar('loadingTransfers')
      : newTransferDisabledReason === 'finishVerificationFirst'
      ? tToolbar('finishVerificationFirst')
      : null;

  const showNewTransferCta =
    canManage && (onNewTransfer != null || newTransferDisabled);

  const newTransferButton = (
    <Button
      type="button"
      colorVariant="accent"
      variant="outline"
      // Right margin matches the gear (w-9 + gap-2) sitting beside the Bank
      // Accounts button, so both section CTAs are vertically aligned.
      className="mr-11 shrink-0"
      disabled={newTransferDisabled}
      onClick={newTransferDisabled ? undefined : onNewTransfer}
    >
      {t('newTransferCta')}
    </Button>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-3 font-semibold tracking-tight text-foreground">
            {t('title')}
          </h4>
          <p className="mt-1 max-w-3xl text-2 text-muted-foreground">
            {t('description')}
          </p>
        </div>
        {showNewTransferCta ? (
          tooltipText && newTransferDisabled ? (
            <span className="inline-flex shrink-0" title={tooltipText}>
              {newTransferButton}
            </span>
          ) : (
            newTransferButton
          )
        ) : null}
      </div>

      {transfersLoading && !hideListLoadingState ? (
        <div className={BANKING_LOADING_STATE_CLASS}>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-2 text-muted-foreground">{t('loading')}</p>
        </div>
      ) : transfers.length === 0 ? (
        <Empty className="w-full">
          <p>{t('emptyTitle')}</p>
          <p className="text-muted-foreground">
            {hasBankCustomer
              ? t('emptyDescription')
              : tNotStarted('description')}
          </p>
        </Empty>
      ) : (
        <div className="w-full">
          <div className={TREASURY_CARD_GRID_CLASS}>
            {transfers.map((transfer) => (
              <BankTransferCard
                key={transfer.id}
                transfer={transfer}
                onViewDetails={() => openDetails(transfer)}
              />
            ))}
          </div>
        </div>
      )}

      <BankTransferDetailsDialog
        transfer={detailsTransfer}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </section>
  );
};
