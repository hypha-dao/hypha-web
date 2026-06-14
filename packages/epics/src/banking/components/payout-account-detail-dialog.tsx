'use client';

import { FC } from 'react';
import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import type { BankPayoutAccountPublic } from '../hooks/types';
import {
  BANKING_DIALOG_FOOTER_CLASS,
  BANKING_DIALOG_FORM_CONTENT_CLASS,
  BANKING_DIALOG_HEADER_CLASS,
  BankingDialogBody,
} from './banking-dialog-layout';
import { CurrencyFlagBadge } from './currency-flag-badge';
import { InlineCopyRow } from './inline-copy-row';

const RAIL_HUMAN_LABELS: Record<string, string> = {
  ach: 'ACH',
  sepa: 'SEPA',
  wire: 'Wire',
  faster_payments: 'Faster Payments',
  swift: 'SWIFT',
};

function humanRailLabel(paymentRail: string): string {
  return RAIL_HUMAN_LABELS[paymentRail.toLowerCase()] ?? paymentRail.toUpperCase();
}

function statusBadgeClass(status: string): string {
  if (status === 'active') return 'bg-success-9 text-white';
  if (status === 'inactive' || status === 'deactivated') return 'bg-neutral-9 text-white';
  return 'bg-warning-9 text-neutral-12';
}

type PayoutAccountDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankPayoutAccountPublic | null;
};

export const PayoutAccountDetailDialog: FC<PayoutAccountDetailDialogProps> = ({
  open,
  onOpenChange,
  account,
}) => {
  const t = useTranslations('BankingTab.payouts');
  const tDialog = useTranslations('BankingTab.payouts.addDialog');

  if (!account) return null;

  const destination = account.destinationCurrency.toLowerCase() as BankCurrencyCode;
  const meta = getBankCurrencyMeta(destination);
  const maskedAccount = account.accountLast4 ? `••••${account.accountLast4}` : null;
  const rail = humanRailLabel(account.paymentRail);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(BANKING_DIALOG_FORM_CONTENT_CLASS, 'max-w-md')}>
        <DialogHeader className={BANKING_DIALOG_HEADER_CLASS}>
          <DialogTitle>{t('detail.title')}</DialogTitle>
          <DialogDescription>
            {account.bankName ?? t('cardBankFallback')}
          </DialogDescription>
        </DialogHeader>

        <BankingDialogBody>
          <div className="flex flex-col gap-4">
            {/* Header row: currency icon + destination + status */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
              {meta ? (
                <CurrencyFlagBadge currency={destination} />
              ) : (
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background-2 text-muted-foreground">
                  <Globe className="h-5 w-5" strokeWidth={1.75} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-2 font-semibold text-foreground">
                  {account.destinationCurrency.toUpperCase()} · {rail}
                </p>
                {maskedAccount ? (
                  <p className="text-1 text-muted-foreground">{maskedAccount}</p>
                ) : null}
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-1 font-medium',
                  statusBadgeClass(account.status),
                )}
              >
                {t(`status.${account.status}`, { defaultValue: account.status })}
              </span>
            </div>

            {/* Source token */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background-2/30 px-3 py-2.5">
              <span className="text-2 text-muted-foreground">{t('detail.sourceToken')}</span>
              <span className="text-2 font-medium text-foreground">
                {account.sourceCurrency.toUpperCase()}
              </span>
            </div>

            {/* Liquidation address */}
            <div className="flex flex-col gap-1.5">
              <p className="text-1 font-semibold uppercase tracking-wide text-muted-foreground">
                {t('liquidationAddressLabel')}
              </p>
              <InlineCopyRow value={account.evmAddress} />
            </div>

            {/* How to use */}
            <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background-2/30 p-4">
              <p className="text-2 font-semibold text-foreground">
                {tDialog('success.howToTitle')}
              </p>
              <p className="text-2 text-muted-foreground">
                {tDialog('success.howToText')}
              </p>
            </div>
          </div>
        </BankingDialogBody>

        <DialogFooter className={BANKING_DIALOG_FOOTER_CLASS}>
          <Button
            type="button"
            colorVariant="accent"
            onClick={() => onOpenChange(false)}
          >
            {t('detail.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
