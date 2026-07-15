'use client';

import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import type { BankCurrencyCode } from '../bank-currency-display';
import {
  getAvailableAddAccountRailOptions,
  isBankRailSelectable,
} from '../banking-ui';
import type {
  BankCustomerPublicStatus,
  BankVirtualAccountPublic,
} from '../hooks/types';
import {
  BANKING_DIALOG_CONTENT_CLASS,
  BANKING_DIALOG_HEADER_CLASS,
  BankingDialogBody,
} from './banking-dialog-layout';
import {
  BankRailActionPicker,
  type BankRailPickerOption,
} from './bank-rail-action-picker';

type AddBankCurrencyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
  status: BankCustomerPublicStatus | null | undefined;
  /** Existing virtual accounts — used to hide already-provisioned (currency, destination) pairs. */
  existingAccounts: BankVirtualAccountPublic[];
  submittingCurrency: BankCurrencyCode | null;
  error: string | null;
  onOpenGear: () => void;
  onAddCurrency: (input: {
    currency: BankCurrencyCode;
    destinationCurrency?: string;
  }) => Promise<void>;
  /** Selects `.person` sibling copy where it diverges. Defaults to the space wording. */
  ownerContext?: 'space' | 'person';
};

export const AddBankCurrencyDialog: FC<AddBankCurrencyDialogProps> = ({
  open,
  onOpenChange,
  spaceSlug,
  status,
  existingAccounts,
  submittingCurrency,
  error,
  onOpenGear,
  onAddCurrency,
  ownerContext = 'space',
}) => {
  const t = useTranslations('BankingTab.openAccount');
  const tOp = useTranslations('BankingTab.operationStatus');
  const isPerson = ownerContext === 'person';
  const descriptionAddCurrencySingle = isPerson
    ? t('person.descriptionAddCurrencySingle')
    : t('descriptionAddCurrencySingle');
  const noCurrenciesAvailable = isPerson
    ? t('person.noCurrenciesAvailable')
    : t('noCurrenciesAvailable');

  const options = useMemo(
    () =>
      status ? getAvailableAddAccountRailOptions(status, existingAccounts) : [],
    [status, existingAccounts],
  );

  const pickerOptions = useMemo((): BankRailPickerOption[] => {
    return options.map((option) => ({
      id: option.railKey,
      currency: option.currency as BankCurrencyCode,
      endorsement: option.endorsement,
      operationalStatus: option.operationalStatus,
      destinationCurrencies: option.destinationCurrencies,
      defaultDestinationCurrency: option.defaultDestinationCurrency,
    }));
  }, [options]);

  const defaultSelectedId = useMemo(() => {
    const approved = pickerOptions.find((option) =>
      isBankRailSelectable(option.operationalStatus),
    );
    return approved?.id ?? pickerOptions[0]?.id ?? '';
  }, [pickerOptions]);

  const [selectedId, setSelectedId] = useState(defaultSelectedId);
  const [destinationCurrency, setDestinationCurrency] = useState('usdc');

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedId(defaultSelectedId);
    const selected = pickerOptions.find(
      (option) => option.id === defaultSelectedId,
    );
    setDestinationCurrency(
      selected?.defaultDestinationCurrency ??
        selected?.destinationCurrencies[0] ??
        'usdc',
    );
  }, [open, defaultSelectedId, pickerOptions]);

  const selectedOption = options.find(
    (option) => option.railKey === selectedId,
  );
  const isSubmitting = submittingCurrency != null;

  const handleAdd = async () => {
    if (
      !selectedOption ||
      !isBankRailSelectable(selectedOption.operationalStatus)
    ) {
      return;
    }
    await onAddCurrency({
      currency: selectedOption.currency as BankCurrencyCode,
      destinationCurrency,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(BANKING_DIALOG_CONTENT_CLASS, 'max-w-md')}>
        <DialogHeader className={BANKING_DIALOG_HEADER_CLASS}>
          <DialogTitle>{t('titleAddCurrency')}</DialogTitle>
          <DialogDescription>{descriptionAddCurrencySingle}</DialogDescription>
        </DialogHeader>

        <BankingDialogBody className="flex flex-col gap-4">
          {!status ? (
            <p className="text-2 text-muted-foreground">
              {t('loadingOptions')}
            </p>
          ) : pickerOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {noCurrenciesAvailable}
            </p>
          ) : (
            <BankRailActionPicker
              mode="account"
              options={pickerOptions}
              selectedId={selectedId}
              onSelectedIdChange={(id) => {
                setSelectedId(id);
                const next = pickerOptions.find((option) => option.id === id);
                setDestinationCurrency(
                  next?.defaultDestinationCurrency ??
                    next?.destinationCurrencies[0] ??
                    'usdc',
                );
              }}
              destinationCurrency={destinationCurrency}
              onDestinationCurrencyChange={setDestinationCurrency}
              primaryActionLabel={t('submitAddCurrency')}
              alternateActionLabel={tOp('continueVerification')}
              primaryActionLoading={
                isSubmitting && submittingCurrency === selectedOption?.currency
              }
              onPrimaryAction={() => {
                if (
                  selectedOption &&
                  isBankRailSelectable(selectedOption.operationalStatus)
                ) {
                  void handleAdd();
                  return;
                }
                onOpenChange(false);
                onOpenGear();
              }}
              disabled={isSubmitting}
            />
          )}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </BankingDialogBody>
      </DialogContent>
    </Dialog>
  );
};
