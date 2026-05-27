'use client';

import {
  FC,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import type {
  BankCurrencyCode,
  BankTransferCorridorKey,
} from '../bank-currency-display';
import {
  getTransferRailOptionsFromStatus,
  isBankRailSelectable,
} from '../banking-ui';
import type { BankCustomerPublicStatus } from '../hooks/types';
import { useRequestEndorsementKyc } from '../hooks/use-request-endorsement-kyc';
import {
  BANKING_DIALOG_FOOTER_CLASS,
  BANKING_DIALOG_FORM_CONTENT_CLASS,
  BANKING_DIALOG_HEADER_CLASS,
  BankingDialogBody,
} from './banking-dialog-layout';
import {
  BankRailActionPicker,
  type BankRailPickerOption,
} from './bank-rail-action-picker';

const CREATE_TRANSFER_FORM_ID = 'create-transfer-form';

type CreateTransferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
  status: BankCustomerPublicStatus | null | undefined;
  isSubmitting: boolean;
  error: string | null;
  onOpenGear: () => void;
  onRefreshStatus?: () => Promise<unknown>;
  onSubmit: (input: {
    corridorKey: BankTransferCorridorKey;
    amount?: string;
    destinationCurrency?: string;
    idempotencyKey?: string;
  }) => Promise<void>;
};

export const CreateTransferDialog: FC<CreateTransferDialogProps> = ({
  open,
  onOpenChange,
  spaceSlug,
  status,
  isSubmitting,
  error,
  onOpenGear,
  onRefreshStatus,
  onSubmit,
}) => {
  const t = useTranslations('BankingTab.createTransfer');
  const { requestEndorsementKyc, isLoading: isRequestingEndorsement } =
    useRequestEndorsementKyc(spaceSlug);

  const options = useMemo(
    () => (status ? getTransferRailOptionsFromStatus(status) : []),
    [status],
  );

  const pickerOptions = useMemo((): BankRailPickerOption[] => {
    return options.map((option) => ({
      id: option.railKey,
      currency: option.currency as BankCurrencyCode,
      corridorKey: option.railKey as BankTransferCorridorKey,
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
  const [useFixedAmount, setUseFixedAmount] = useState(true);
  const [amount, setAmount] = useState('');

  // One key per (open session + transfer parameters): a retry of the same
  // transfer reuses it so Bridge dedupes; changing any input mints a new key.
  const idempotencyKey = useMemo(
    () => crypto.randomUUID(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, selectedId, destinationCurrency, useFixedAmount, amount],
  );

  const sanitizeAmountInput = (raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '');
    const dotIndex = cleaned.indexOf('.');
    if (dotIndex === -1) {
      return cleaned;
    }
    const integerPart = cleaned.slice(0, dotIndex);
    const fractionalPart = cleaned.slice(dotIndex + 1).replace(/\./g, '');
    return `${integerPart}.${fractionalPart}`;
  };

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
    setUseFixedAmount(true);
    setAmount('');
  }, [open, defaultSelectedId, pickerOptions]);

  const selectedOption = options.find(
    (option) => option.railKey === selectedId,
  );

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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !selectedOption ||
      !isBankRailSelectable(selectedOption.operationalStatus)
    ) {
      return;
    }

    await onSubmit({
      corridorKey: selectedOption.railKey as BankTransferCorridorKey,
      amount: useFixedAmount && amount.trim() ? amount.trim() : undefined,
      destinationCurrency,
      idempotencyKey,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(BANKING_DIALOG_FORM_CONTENT_CLASS, 'max-w-md')}
      >
        <DialogHeader className={BANKING_DIALOG_HEADER_CLASS}>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <BankingDialogBody>
          <form
            id={CREATE_TRANSFER_FORM_ID}
            onSubmit={(e) => void handleSubmit(e)}
            className="flex flex-col gap-4"
          >
            {!status ? (
              <p className="text-2 text-muted-foreground">
                {t('loadingOptions')}
              </p>
            ) : pickerOptions.length === 0 ? (
              <p className="text-2 text-muted-foreground">
                {t('noCorridorsAvailable')}
              </p>
            ) : (
              <BankRailActionPicker
                mode="transfer"
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
                primaryActionLabel={t('submit')}
                onPrimaryAction={() => {}}
                showPrimaryAction={false}
                requestEndorsementLoading={isRequestingEndorsement}
                onRequestEndorsement={handleRequestEndorsement}
                disabled={isSubmitting}
              />
            )}

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-2">
                <input
                  type="checkbox"
                  checked={useFixedAmount}
                  onChange={(e) => setUseFixedAmount(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                  disabled={isSubmitting}
                />
                {t('fixedAmountLabel')}
              </label>
              {useFixedAmount ? (
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={t('amountPlaceholder')}
                  value={amount}
                  onChange={(e) =>
                    setAmount(sanitizeAmountInput(e.target.value))
                  }
                  disabled={isSubmitting}
                />
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </BankingDialogBody>

        <DialogFooter className={BANKING_DIALOG_FOOTER_CLASS}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            form={CREATE_TRANSFER_FORM_ID}
            colorVariant="accent"
            disabled={
              isSubmitting ||
              !selectedOption ||
              !isBankRailSelectable(selectedOption.operationalStatus)
            }
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
