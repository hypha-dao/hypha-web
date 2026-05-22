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

import {
  BANK_CURRENCY_METAS,
  getDefaultBankCurrencyCodes,
  type BankCurrencyCode,
} from '../bank-currency-display';
import type { BankVirtualAccountCurrency } from '../hooks/types';
import { CurrencyOptionRow } from './currency-option-row';

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
    currency: BankVirtualAccountCurrency;
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
  const currencyOptions = useMemo(
    () => BANK_CURRENCY_METAS.map((m) => m.currency),
    [],
  );

  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [currency, setCurrency] = useState<BankCurrencyCode>('eur');
  const [useFixedAmount, setUseFixedAmount] = useState(false);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setLegalName(initialLegalName.trim());
    setContactEmail(initialContactEmail.trim());
    const defaults = getDefaultBankCurrencyCodes();
    setCurrency(defaults[0] ?? 'eur');
    setUseFixedAmount(false);
    setAmount('');
  }, [open, initialContactEmail, initialLegalName]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      legalName: customerFieldsLocked ? undefined : legalName.trim(),
      contactEmail: customerFieldsLocked ? undefined : contactEmail.trim(),
      currency: currency as BankVirtualAccountCurrency,
      amount: useFixedAmount && amount.trim() ? amount.trim() : undefined,
    });
  };

  const showCustomerFields = !customerFieldsLocked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="transfer-legal-name">{tOpen('legalName')}</Label>
              <Input
                id="transfer-legal-name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required={showCustomerFields}
                disabled={isSubmitting || customerFieldsLocked}
                readOnly={customerFieldsLocked}
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
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('currencyLabel')}</Label>
              <div className="flex flex-col gap-2">
                {currencyOptions.map((code) => (
                  <CurrencyOptionRow
                    key={code}
                    currency={code}
                    selected={currency === code}
                    onSelect={() => setCurrency(code)}
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
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isSubmitting}
                />
              ) : (
                <p className="text-2 text-muted-foreground">
                  {t('flexibleAmountHint')}
                </p>
              )}
            </div>

            {error ? <p className="text-2 text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
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
        </form>
      </DialogContent>
    </Dialog>
  );
};
