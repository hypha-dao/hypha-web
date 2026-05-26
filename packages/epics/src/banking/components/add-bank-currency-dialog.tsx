'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
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
  getAddAccountRailOptionsFromStatus,
  isBankRailSelectable,
} from '../banking-ui';
import { useRequestEndorsementKyc } from '../hooks/use-request-endorsement-kyc';
import type { BankCustomerPublicStatus } from '../hooks/types';
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
  submittingCurrency: BankCurrencyCode | null;
  error: string | null;
  onOpenGear: () => void;
  onRefreshStatus?: () => Promise<unknown>;
  onAddCurrency: (input: {
    currency: BankCurrencyCode;
    destinationCurrency?: string;
  }) => Promise<void>;
};

export const AddBankCurrencyDialog: FC<AddBankCurrencyDialogProps> = ({
  open,
  onOpenChange,
  spaceSlug,
  status,
  submittingCurrency,
  error,
  onOpenGear,
  onRefreshStatus,
  onAddCurrency,
}) => {
  const t = useTranslations('BankingTab.openAccount');
  const tOp = useTranslations('BankingTab.operationStatus');
  const { requestEndorsementKyc, isLoading: isRequestingEndorsement } =
    useRequestEndorsementKyc(spaceSlug);

  const options = useMemo(
    () => (status ? getAddAccountRailOptionsFromStatus(status) : []),
    [status],
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
    const selected = pickerOptions.find((option) => option.id === defaultSelectedId);
    setDestinationCurrency(
      selected?.defaultDestinationCurrency ??
        selected?.destinationCurrencies[0] ??
        'usdc',
    );
  }, [open, defaultSelectedId, pickerOptions]);

  const selectedOption = options.find((option) => option.railKey === selectedId);
  const isSubmitting = submittingCurrency != null;

  const handleRequestEndorsement = useCallback(
    async (endorsement: string) => {
      const { kycLinkUrl } = await requestEndorsementKyc(endorsement);
      window.open(kycLinkUrl, '_blank', 'noopener,noreferrer');
      onOpenChange(false);
      onOpenGear();
      void onRefreshStatus?.();
    },
    [onOpenChange, onOpenGear, onRefreshStatus, requestEndorsementKyc],
  );

  const handleAdd = async () => {
    if (!selectedOption || !isBankRailSelectable(selectedOption.operationalStatus)) {
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
          <DialogDescription>
            {t('descriptionAddCurrencySingle')}
          </DialogDescription>
        </DialogHeader>

        <BankingDialogBody className="flex flex-col gap-4">
          {!status ? (
            <p className="text-2 text-muted-foreground">{t('loadingOptions')}</p>
          ) : pickerOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('noCurrenciesAvailable')}
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
                isSubmitting &&
                submittingCurrency === selectedOption?.currency
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
              requestEndorsementLoading={isRequestingEndorsement}
              onRequestEndorsement={handleRequestEndorsement}
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
