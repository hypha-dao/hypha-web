'use client';

import { FC, FormEvent, useEffect, useMemo, useState } from 'react';
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
  Label,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  BANK_TRANSFER_CORRIDOR_KEYS,
  type BankTransferCorridorKey,
} from '../bank-currency-display';
import { BANKING_READONLY_INPUT_CLASS } from '../banking-ui';
import {
  BANKING_DIALOG_FOOTER_CLASS,
  BANKING_DIALOG_FORM_CONTENT_CLASS,
  BANKING_DIALOG_HEADER_CLASS,
  BankingDialogBody,
} from './banking-dialog-layout';
import { TransferCorridorOptionRow } from './transfer-corridor-option-row';

const CREATE_TRANSFER_FORM_ID = 'create-transfer-form';

type CreateTransferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerFieldsLocked?: boolean;
  initialLegalName?: string;
  initialContactEmail?: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: {
    legalName?: string;
    contactEmail?: string;
    corridorKey: BankTransferCorridorKey;
    amount?: string;
  }) => Promise<void>;
};

export const CreateTransferDialog: FC<CreateTransferDialogProps> = ({
  open,
  onOpenChange,
  customerFieldsLocked = false,
  initialLegalName = '',
  initialContactEmail = '',
  isSubmitting,
  error,
  onSubmit,
}) => {
  const t = useTranslations('BankingTab.createTransfer');
  const tOpen = useTranslations('BankingTab.openAccount');
  const corridorOptions = useMemo(() => [...BANK_TRANSFER_CORRIDOR_KEYS], []);

  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [corridorKey, setCorridorKey] =
    useState<BankTransferCorridorKey>('eur');
  const [useFixedAmount, setUseFixedAmount] = useState(true);
  const [amount, setAmount] = useState('');

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
    setLegalName(initialLegalName.trim());
    setContactEmail(initialContactEmail.trim());
    setCorridorKey('eur');
    setUseFixedAmount(true);
    setAmount('');
  }, [open, initialContactEmail, initialLegalName]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      legalName: customerFieldsLocked ? undefined : legalName.trim(),
      contactEmail: customerFieldsLocked ? undefined : contactEmail.trim(),
      corridorKey,
      amount: useFixedAmount && amount.trim() ? amount.trim() : undefined,
    });
  };

  const showCustomerFields = !customerFieldsLocked;

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
            <div className="flex flex-col gap-2">
              <Label htmlFor="transfer-legal-name">{tOpen('legalName')}</Label>
              <Input
                id="transfer-legal-name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required={showCustomerFields}
                disabled={isSubmitting || customerFieldsLocked}
                readOnly={customerFieldsLocked}
                tabIndex={customerFieldsLocked ? -1 : undefined}
                className={
                  customerFieldsLocked
                    ? BANKING_READONLY_INPUT_CLASS
                    : undefined
                }
                onFocus={
                  customerFieldsLocked
                    ? (event) => event.currentTarget.blur()
                    : undefined
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="transfer-contact-email">
                {tOpen('contactEmail')}
              </Label>
              <Input
                id="transfer-contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required={showCustomerFields}
                disabled={isSubmitting || customerFieldsLocked}
                readOnly={customerFieldsLocked}
                tabIndex={customerFieldsLocked ? -1 : undefined}
                className={
                  customerFieldsLocked
                    ? BANKING_READONLY_INPUT_CLASS
                    : undefined
                }
                onFocus={
                  customerFieldsLocked
                    ? (event) => event.currentTarget.blur()
                    : undefined
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('corridorLabel')}</Label>
              <p className="text-1 text-muted-foreground">
                {t('corridorHint')}
              </p>
              <div className="flex flex-col gap-2">
                {corridorOptions.map((key) => (
                  <TransferCorridorOptionRow
                    key={key}
                    corridorKey={key}
                    selected={corridorKey === key}
                    disabled={isSubmitting}
                    onSelect={() => setCorridorKey(key)}
                  />
                ))}
              </div>
            </div>

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
              ) : (
                <p className="text-2 text-muted-foreground">
                  {t('flexibleAmountHint')}
                </p>
              )}
            </div>

            {error ? <p className="text-2 text-destructive">{error}</p> : null}
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
              (useFixedAmount && !amount.trim()) ||
              (showCustomerFields &&
                (!legalName.trim() || !contactEmail.trim()))
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('submitting')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
