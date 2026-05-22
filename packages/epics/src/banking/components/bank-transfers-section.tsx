'use client';

import { FC, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';

import {
  BANKING_EMPTY_STATE_CLASS,
  BANKING_LOADING_STATE_CLASS,
  TREASURY_CARD_GRID_CLASS,
} from '../banking-ui';
import type {
  BankTransferPublic,
  BankVirtualAccountCurrency,
} from '../hooks/types';
import { BankTransferCard } from './bank-transfer-card';
import { BankTransferDetailsDialog } from './bank-transfer-details-dialog';

export type BankTransfersSectionProps = {
  transfers: BankTransferPublic[];
  transfersLoading: boolean;
  canManage: boolean;
  isActivating: boolean;
  onOpenVerificationDetails: () => void;
  onActivateTransfer: (transferId: number) => void;
  onNewPaymentLink?: () => void;
};

export const BankTransfersSection: FC<BankTransfersSectionProps> = ({
  transfers,
  transfersLoading,
  canManage,
  isActivating,
  onOpenVerificationDetails,
  onActivateTransfer,
  onNewPaymentLink,
}) => {
  const t = useTranslations('BankingTab.sections.transfers');
  const tToolbar = useTranslations('BankingTab.toolbar');
  const [detailsTransfer, setDetailsTransfer] =
    useState<BankTransferPublic | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const openDetails = (transfer: BankTransferPublic) => {
    setDetailsTransfer(transfer);
    setDetailsOpen(true);
  };

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
        {canManage && onNewPaymentLink ? (
          <Button
            type="button"
            colorVariant="accent"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={onNewPaymentLink}
          >
            <Plus className="h-4 w-4" />
            {tToolbar('newPaymentLink')}
          </Button>
        ) : null}
      </div>

      {transfersLoading ? (
        <div className={BANKING_LOADING_STATE_CLASS}>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-2 text-muted-foreground">{t('loading')}</p>
        </div>
      ) : transfers.length === 0 ? (
        <div className={BANKING_EMPTY_STATE_CLASS}>
          <p className="text-3 font-medium text-foreground">
            {t('emptyTitle')}
          </p>
          <p className="mx-auto max-w-md text-2 text-muted-foreground">
            {t('emptyDescription')}
          </p>
        </div>
      ) : (
        <div className="w-full">
          <div className={TREASURY_CARD_GRID_CLASS}>
            {transfers.map((transfer) => (
              <BankTransferCard
                key={transfer.id}
                transfer={transfer}
                onViewDetails={() => openDetails(transfer)}
                onOpenVerificationDetails={
                  canManage && transfer.lifecycle === 'pending_kyb'
                    ? onOpenVerificationDetails
                    : undefined
                }
                onActivate={
                  canManage && transfer.canActivate
                    ? () => onActivateTransfer(transfer.id)
                    : undefined
                }
                isActivating={isActivating}
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
