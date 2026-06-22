'use client';

import { FC, useEffect, useId } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Label } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import type {
  BankCurrencyCode,
  BankTransferCorridorKey,
} from '../bank-currency-display';
import { isBankRailSelectable } from '../banking-ui';
import type { BankCurrencyOperationalStatus } from '../hooks/types';
import { BankDepositRailOptionRow } from './bank-deposit-rail-option-row';

export type BankRailPickerOption = {
  id: string;
  currency: BankCurrencyCode;
  corridorKey?: BankTransferCorridorKey;
  endorsement: string;
  operationalStatus: BankCurrencyOperationalStatus;
  destinationCurrencies: string[];
  defaultDestinationCurrency: string;
};

type BankRailActionPickerProps = {
  mode: 'account' | 'transfer';
  options: BankRailPickerOption[];
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
  destinationCurrency: string;
  onDestinationCurrencyChange: (currency: string) => void;
  primaryActionLabel: string;
  alternateActionLabel?: string;
  primaryActionLoading?: boolean;
  primaryActionDisabled?: boolean;
  onPrimaryAction: () => void;
  disabled?: boolean;
  showPrimaryAction?: boolean;
};

export const BankRailActionPicker: FC<BankRailActionPickerProps> = ({
  mode,
  options,
  selectedId,
  onSelectedIdChange,
  destinationCurrency,
  onDestinationCurrencyChange,
  primaryActionLabel,
  alternateActionLabel,
  primaryActionLoading = false,
  primaryActionDisabled = false,
  onPrimaryAction,
  disabled = false,
  showPrimaryAction = true,
}) => {
  const tOpenAccount = useTranslations('BankingTab.openAccount');
  const tCreateTransfer = useTranslations('BankingTab.createTransfer');
  const tDeposit = useTranslations('BankingTab.depositInstructions');
  const radioName = useId();

  const selected = options.find((option) => option.id === selectedId);
  const destinationChoices = selected?.destinationCurrencies ?? [];

  useEffect(() => {
    if (destinationChoices.length === 0) {
      return;
    }
    if (!destinationChoices.includes(destinationCurrency)) {
      onDestinationCurrencyChange(
        selected?.defaultDestinationCurrency ?? destinationChoices[0] ?? 'usdc',
      );
    }
  }, [
    destinationChoices,
    destinationCurrency,
    onDestinationCurrencyChange,
    selected?.defaultDestinationCurrency,
  ]);

  const showDestinationChoice = destinationChoices.length > 0;
  const canSubmit =
    selected != null && isBankRailSelectable(selected.operationalStatus);
  const primaryLabel =
    canSubmit || !alternateActionLabel
      ? primaryActionLabel
      : alternateActionLabel;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>
          {mode === 'account'
            ? tOpenAccount('bankAccountDepositLabel')
            : tCreateTransfer('corridorLabel')}
        </Label>
        <p className="text-1 text-muted-foreground">
          {mode === 'account'
            ? tOpenAccount('bankAccountDepositHint')
            : tCreateTransfer('corridorHint')}
        </p>
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const rowDisabled =
              disabled ||
              primaryActionLoading ||
              !isBankRailSelectable(option.operationalStatus);

            return (
              <BankDepositRailOptionRow
                key={option.id}
                mode={mode}
                currency={option.currency}
                corridorKey={option.corridorKey}
                selected={selectedId === option.id}
                disabled={rowDisabled}
                radioName={radioName}
                onSelect={() => onSelectedIdChange(option.id)}
              />
            );
          })}
        </div>
      </div>

      {showDestinationChoice ? (
        <div className="flex flex-col gap-2">
          <Label>{tDeposit('destinationCurrency')}</Label>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label={tDeposit('destinationCurrency')}
          >
            {destinationChoices.map((currency) => {
              const isActive = destinationCurrency === currency;
              return (
                <button
                  key={currency}
                  type="button"
                  disabled={disabled || primaryActionLoading || !canSubmit}
                  className={cn(
                    'rounded-md border px-3 py-2 text-2 font-medium transition-colors',
                    isActive
                      ? 'border-accent-9 bg-accent-9 text-accent-contrast shadow-sm'
                      : 'border-border bg-card text-foreground hover:bg-background-2/80',
                    (disabled || primaryActionLoading || !canSubmit) &&
                      'cursor-not-allowed opacity-60',
                  )}
                  onClick={() => onDestinationCurrencyChange(currency)}
                >
                  {currency.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showPrimaryAction && selected ? (
        <Button
          type="button"
          colorVariant="accent"
          className="w-full"
          disabled={
            disabled ||
            primaryActionLoading ||
            primaryActionDisabled ||
            (!canSubmit && !alternateActionLabel)
          }
          onClick={() => onPrimaryAction()}
        >
          {primaryActionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            primaryLabel
          )}
        </Button>
      ) : null}
    </div>
  );
};
