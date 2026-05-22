'use client';

import { FC, useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';
import { copyToClipboard } from '@hypha-platform/ui-utils';

import type {
  BankTransferPublic,
  BankVirtualAccountPublic,
} from '../hooks/types';

type DepositInstructionSource = {
  paymentRail: string;
  depositInstructions: Record<string, unknown>;
  depositMessage?: string;
};

type FieldDef = {
  key: string;
  labelKey: string;
};

function getFieldsForRail(paymentRail: string): FieldDef[] {
  switch (paymentRail) {
    case 'sepa':
      return [
        { key: 'iban', labelKey: 'iban' },
        { key: 'bic', labelKey: 'bic' },
        { key: 'bank_name', labelKey: 'bankName' },
      ];
    case 'ach':
      return [
        { key: 'bank_routing_number', labelKey: 'routingNumber' },
        { key: 'bank_account_number', labelKey: 'accountNumber' },
        { key: 'bank_name', labelKey: 'bankName' },
      ];
    case 'faster_payments':
      return [
        { key: 'account_number', labelKey: 'accountNumber' },
        { key: 'sort_code', labelKey: 'sortCode' },
        { key: 'bank_name', labelKey: 'bankName' },
      ];
    case 'spei':
    case 'pix':
    case 'cop':
    default:
      return [];
  }
}

function CopyableValue({ value }: { value: string }) {
  const t = useTranslations('BankingTab.depositInstructions');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <dd className="min-w-0 flex-1 break-all font-mono text-2 text-foreground">
        {value}
      </dd>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 shrink-0 px-0"
        onClick={handleCopy}
        aria-label={copied ? t('copied') : t('copy')}
      >
        {copied ? (
          <Check className="h-4 w-4 text-success-11" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}

type DepositInstructionsFieldsProps = {
  account?: BankVirtualAccountPublic;
  transfer?: BankTransferPublic;
};

function toSource(
  props: DepositInstructionsFieldsProps,
): DepositInstructionSource | null {
  if (props.transfer) {
    return {
      paymentRail: props.transfer.paymentRail,
      depositInstructions: props.transfer.depositInstructions,
      depositMessage: props.transfer.depositMessage,
    };
  }
  if (props.account) {
    return {
      paymentRail: props.account.paymentRail,
      depositInstructions: props.account.depositInstructions,
    };
  }
  return null;
}

export const DepositInstructionsFields: FC<DepositInstructionsFieldsProps> = (
  props,
) => {
  const tFields = useTranslations('BankingTab.depositInstructions');
  const source = toSource(props);
  if (!source) {
    return null;
  }

  const instructions = source.depositInstructions;
  const depositMessage =
    source.depositMessage ??
    (typeof instructions.deposit_message === 'string'
      ? instructions.deposit_message
      : null);

  const knownFields = getFieldsForRail(source.paymentRail);
  const knownKeys = new Set([
    ...knownFields.map((f) => f.key),
    'deposit_message',
  ]);

  const extraEntries = Object.entries(instructions).filter(
    ([key, value]) =>
      !knownKeys.has(key) &&
      value != null &&
      value !== '' &&
      typeof value !== 'object',
  );

  return (
    <dl className="flex flex-col gap-3">
      {depositMessage ? (
        <div className="flex flex-col gap-1 rounded-md border border-accent-6 bg-accent-2 px-3 py-3 sm:flex-row sm:gap-4">
          <dt className="shrink-0 text-2 font-semibold text-foreground sm:w-36">
            {tFields('depositMessage')}
          </dt>
          <CopyableValue value={depositMessage} />
        </div>
      ) : null}
      {knownFields.map(({ key, labelKey }) => {
        const value = instructions[key];
        if (value == null || value === '') {
          return null;
        }
        return (
          <div
            key={key}
            className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4"
          >
            <dt className="shrink-0 text-2 font-medium text-muted-foreground sm:w-36">
              {tFields(labelKey)}
            </dt>
            <CopyableValue value={String(value)} />
          </div>
        );
      })}
      {extraEntries.map(([key, value]) => (
        <div
          key={key}
          className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4"
        >
          <dt className="shrink-0 text-2 font-medium capitalize text-muted-foreground sm:w-36">
            {key.replace(/_/g, ' ')}
          </dt>
          <CopyableValue value={String(value)} />
        </div>
      ))}
    </dl>
  );
};
