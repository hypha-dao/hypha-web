'use client';

import { FC, FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Input, Label } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  BANK_CURRENCY_METAS,
  getDefaultBankCurrencyCodes,
  type BankCurrencyCode,
} from '../bank-currency-display';
import { CurrencyOptionRow } from './currency-option-row';

export type BankingInitialSetupProps = {
  initialLegalName: string;
  initialContactEmail: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: {
    legalName: string;
    contactEmail: string;
    currencies: BankCurrencyCode[];
  }) => Promise<void>;
};

export const BankingInitialSetup: FC<BankingInitialSetupProps> = ({
  initialLegalName,
  initialContactEmail,
  isSubmitting,
  error,
  onSubmit,
}) => {
  const t = useTranslations('BankingTab.initialSetup');
  const tOpen = useTranslations('BankingTab.openAccount');

  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [selected, setSelected] = useState<BankCurrencyCode[]>(() => [
    ...getDefaultBankCurrencyCodes(),
  ]);

  useEffect(() => {
    setLegalName(initialLegalName.trim());
    setContactEmail(initialContactEmail.trim());
    setSelected([...getDefaultBankCurrencyCodes()]);
  }, [initialContactEmail, initialLegalName]);

  const toggleCurrency = (currency: BankCurrencyCode, checked: boolean) => {
    setSelected((current) =>
      checked ? [...current, currency] : current.filter((c) => c !== currency),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (selected.length === 0 || !legalName.trim() || !contactEmail.trim()) {
      return;
    }

    await onSubmit({
      legalName: legalName.trim(),
      contactEmail: contactEmail.trim(),
      currencies: selected,
    });
  };

  const canSubmit =
    selected.length > 0 &&
    Boolean(legalName.trim()) &&
    Boolean(contactEmail.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'grid w-full max-w-xl grid-cols-1 gap-6',
        'lg:max-w-5xl lg:grid-cols-2 lg:gap-x-10 lg:items-start',
      )}
    >
      <section
        className="order-1 flex flex-col gap-4 lg:col-start-1 lg:row-start-1"
        aria-labelledby="banking-setup-org"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="banking-setup-org"
            className="text-3 font-semibold tracking-tight text-foreground"
          >
            {t('organizationLegend')}
          </h2>
          <p className="text-2 text-muted-foreground">
            {t('organizationHint')}
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="banking-setup-legal-name">
              {tOpen('legalName')}
            </Label>
            <Input
              id="banking-setup-legal-name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              required
              maxLength={1024}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="banking-setup-email">{tOpen('contactEmail')}</Label>
            <Input
              id="banking-setup-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>
      </section>

      <section
        className="order-2 flex flex-col gap-3 lg:col-start-2 lg:row-start-1"
        aria-labelledby="banking-setup-currencies"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="banking-setup-currencies"
            className="text-3 font-semibold tracking-tight text-foreground"
          >
            {t('currenciesTitle')}
          </h2>
          <p className="text-2 text-muted-foreground">
            {t('currenciesDescription')}
          </p>
          <p className="text-1 text-muted-foreground">{t('currenciesHint')}</p>
        </div>
        <div className="flex flex-col gap-2">
          {BANK_CURRENCY_METAS.map((meta) => (
            <CurrencyOptionRow
              key={meta.currency}
              currency={meta.currency}
              checked={selected.includes(meta.currency)}
              disabled={isSubmitting}
              onCheckedChange={(checked) =>
                toggleCurrency(meta.currency, checked)
              }
            />
          ))}
        </div>
      </section>

      <div className="order-3 flex flex-col gap-3 lg:col-span-2 lg:row-start-2 lg:items-end">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          colorVariant="accent"
          className="w-full sm:w-fit"
          disabled={isSubmitting || !canSubmit}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {tOpen('submitting')}
            </>
          ) : (
            t('submit')
          )}
        </Button>
      </div>
    </form>
  );
};
