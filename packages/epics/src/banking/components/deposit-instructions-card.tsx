'use client';

import { FC, useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';
import { copyToClipboard } from '@hypha-platform/ui-utils';

import type { BankVirtualAccountPublic } from '../hooks/types';

type DepositInstructionsCardProps = {
  account: BankVirtualAccountPublic;
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
    case 'wire':
      return [
        { key: 'bank_routing_number', labelKey: 'routingNumber' },
        { key: 'bank_account_number', labelKey: 'accountNumber' },
        { key: 'bank_beneficiary_name', labelKey: 'beneficiaryName' },
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

const endorsementLabelKeys = [
  'base',
  'sepa',
  'faster_payments',
  'spei',
  'pix',
  'cop',
] as const;

type EndorsementLabelKey = (typeof endorsementLabelKeys)[number];

function getEndorsementLabelKey(paymentRail: string): EndorsementLabelKey {
  if (paymentRail === 'ach') {
    return 'base';
  }
  if ((endorsementLabelKeys as readonly string[]).includes(paymentRail)) {
    return paymentRail as EndorsementLabelKey;
  }
  return 'base';
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
      <dd className="min-w-0 flex-1 font-mono text-2 text-foreground break-all">
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

export const DepositInstructionsCard: FC<DepositInstructionsCardProps> = ({
  account,
}) => {
  const t = useTranslations('BankingTab');
  const tFields = useTranslations('BankingTab.depositInstructions');
  const instructions = account.depositInstructions;

  const knownFields = getFieldsForRail(account.paymentRail);
  const knownKeys = new Set(knownFields.map((f) => f.key));

  const extraEntries = Object.entries(instructions).filter(
    ([key, value]) =>
      !knownKeys.has(key) &&
      value != null &&
      value !== '' &&
      typeof value !== 'object',
  );

  const titleKey = getEndorsementLabelKey(account.paymentRail);

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="border-l-4 border-success-9 bg-success-2/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-3 font-semibold text-foreground">
            {t(`endorsements.${titleKey}`)}
          </p>
          <span className="rounded-full bg-success-9 px-2.5 py-0.5 text-1 font-medium text-white">
            {t('depositInstructions.activeBadge')}
          </span>
        </div>
        <p className="mt-1 text-2 text-muted-foreground">
          {t('depositInstructions.shareHint')}
        </p>
      </div>
      <dl className="flex flex-col gap-3 px-4 py-4">
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
    </article>
  );
};
