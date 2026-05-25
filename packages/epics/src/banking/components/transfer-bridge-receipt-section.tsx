'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

import { readBridgeTransferReceipt } from '../deposit-instruction-display';
import { BANKING_READONLY_SURFACE_CLASS } from '../banking-ui';

type TransferReceiptBoxProps = {
  depositInstructions: Record<string, unknown>;
};

const RECEIPT_FIELD_KEYS = [
  'initialAmount',
  'developerFee',
  'exchangeFee',
  'subtotalAmount',
  'gasFee',
] as const;

export const TransferReceiptBox: FC<TransferReceiptBoxProps> = ({
  depositInstructions,
}) => {
  const tDetails = useTranslations('BankingTab.transferDetails');
  const t = useTranslations('BankingTab.transferDetails.receiptFields');

  const receipt = readBridgeTransferReceipt(depositInstructions);
  if (!receipt) {
    return null;
  }

  const lines = RECEIPT_FIELD_KEYS.map((key) => {
    const value = receipt[key];
    return value ? { labelKey: key, value } : null;
  }).filter(
    (
      line,
    ): line is {
      labelKey: (typeof RECEIPT_FIELD_KEYS)[number];
      value: string;
    } => Boolean(line),
  );

  if (lines.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 opacity-80">
      <h5 className="text-2 font-semibold text-foreground">
        {tDetails('receiptHeading')}
      </h5>
      <div
        className={cn(
          BANKING_READONLY_SURFACE_CLASS,
          'rounded-md px-3 py-3 flex flex-col gap-1.5',
        )}
      >
        {lines.map((line) => (
          <p key={line.labelKey} className="text-2 text-foreground">
            <span className="font-medium text-muted-foreground">
              {t(line.labelKey)}:{' '}
            </span>
            {line.value}
          </p>
        ))}
      </div>
    </section>
  );
};

/** @deprecated Use TransferReceiptBox */
export const TransferBridgeReceiptSection = TransferReceiptBox;
