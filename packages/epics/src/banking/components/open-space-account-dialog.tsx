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
import { CurrencyOptionRow } from './currency-option-row';

export type OpenSpaceAccountDialogMode = 'full' | 'addCurrency';

type OpenSpaceAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: OpenSpaceAccountDialogMode;
  customerFieldsLocked?: boolean;
  availableCurrencies?: BankCurrencyCode[];
  initialLegalName?: string;
  initialContactEmail?: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: {
    legalName: string;
    contactEmail: string;
    currencies: BankCurrencyCode[];
  }) => Promise<void>;
};

export const OpenSpaceAccountDialog: FC<OpenSpaceAccountDialogProps> = ({
  open,
  onOpenChange,
  mode = 'full',
  customerFieldsLocked = false,
  availableCurrencies,
  initialLegalName = '',
  initialContactEmail = '',
  isSubmitting,
  error,
  onSubmit,
}) => {
  const t = useTranslations('BankingTab.openAccount');
  const isAddMode = mode === 'addCurrency';
  const showCustomerFields = !isAddMode || customerFieldsLocked;

  const currencyOptions = useMemo(() => {
    if (availableCurrencies && availableCurrencies.length > 0) {
      return availableCurrencies;
    }
    if (isAddMode) {
      return [];
    }
    return BANK_CURRENCY_METAS.map((m) => m.currency);
  }, [availableCurrencies, isAddMode]);

  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [selected, setSelected] = useState<BankCurrencyCode[]>(() =>
    getDefaultBankCurrencyCodes().filter((c) => currencyOptions.includes(c)),
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setLegalName(initialLegalName.trim());
    setContactEmail(initialContactEmail.trim());
    const defaults = getDefaultBankCurrencyCodes().filter((c) =>
      currencyOptions.includes(c),
    );
    setSelected(defaults.length > 0 ? defaults : [...currencyOptions]);
  }, [open, initialLegalName, initialContactEmail, currencyOptions]);

  const toggleCurrency = (currency: BankCurrencyCode, checked: boolean) => {
    setSelected((current) =>
      checked ? [...current, currency] : current.filter((c) => c !== currency),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) {
      return;
    }
    if (
      !customerFieldsLocked &&
      !isAddMode &&
      (!legalName.trim() || !contactEmail.trim())
    ) {
      return;
    }

    await onSubmit({
      legalName: legalName.trim(),
      contactEmail: contactEmail.trim(),
      currencies: selected,
    });
  };

  const formId = 'open-space-account-form';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isAddMode ? t('titleAddCurrency') : t('title')}
          </DialogTitle>
          <DialogDescription>
            {isAddMode ? t('descriptionAddCurrency') : t('description')}
          </DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {showCustomerFields ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="open-account-legal-name">
                  {t('legalName')}
                </Label>
                <Input
                  id="open-account-legal-name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  required={!customerFieldsLocked}
                  maxLength={1024}
                  disabled={isSubmitting || customerFieldsLocked}
                  readOnly={customerFieldsLocked}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="open-account-email">{t('contactEmail')}</Label>
                <Input
                  id="open-account-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required={!customerFieldsLocked}
                  disabled={isSubmitting || customerFieldsLocked}
                  readOnly={customerFieldsLocked}
                />
              </div>
            </>
          ) : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
              {t('currenciesLabel')}
            </legend>
            <p className="text-sm text-muted-foreground">
              {t('currenciesHint')}
            </p>
            {currencyOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('noCurrenciesAvailable')}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {currencyOptions.map((currency) => (
                  <CurrencyOptionRow
                    key={currency}
                    currency={currency}
                    checked={selected.includes(currency)}
                    disabled={isSubmitting}
                    onCheckedChange={(checked) =>
                      toggleCurrency(currency, checked)
                    }
                  />
                ))}
              </div>
            )}
          </fieldset>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>

        <DialogFooter>
          <Button
            type="submit"
            form={formId}
            colorVariant="accent"
            disabled={
              isSubmitting ||
              selected.length === 0 ||
              currencyOptions.length === 0
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('submitting')}
              </>
            ) : isAddMode ? (
              t('submitAddCurrency')
            ) : (
              t('submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
