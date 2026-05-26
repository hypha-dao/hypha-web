'use client';

import { FC, FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, Input, Label } from '@hypha-platform/ui';

import {
  BANK_CURRENCY_METAS,
  getDefaultBankCurrencyCodes,
  type BankCurrencyCode,
} from '../../bank-currency-display';
import type { ProviderOnboardingFormProps } from './types';

export const BridgeOnboardingForm: FC<ProviderOnboardingFormProps> = ({
  formId,
  onSubmit,
  isSubmitting,
  initialValues,
}) => {
  const t = useTranslations('BankingTab.onboardingDialog');
  const tCurrencies = useTranslations('BankingTab.currencies');

  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [requestedRails, setRequestedRails] = useState<BankCurrencyCode[]>([
    ...getDefaultBankCurrencyCodes(),
  ]);

  useEffect(() => {
    setLegalName(initialValues?.legalName?.trim() ?? '');
    setContactEmail(initialValues?.contactEmail?.trim() ?? '');
    const nextRails =
      initialValues?.requestedRails && initialValues.requestedRails.length > 0
        ? (initialValues.requestedRails as BankCurrencyCode[])
        : [...getDefaultBankCurrencyCodes()];
    setRequestedRails(nextRails);
  }, [initialValues]);

  const toggleRail = (currency: BankCurrencyCode, checked: boolean) => {
    setRequestedRails((current) =>
      checked ? [...current, currency] : current.filter((c) => c !== currency),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = legalName.trim();
    const trimmedEmail = contactEmail.trim();

    if (!trimmedName || !trimmedEmail || requestedRails.length === 0) {
      return;
    }

    await onSubmit({
      legalName: trimmedName,
      contactEmail: trimmedEmail,
      requestedRails,
    });
  };

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 py-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="bank-legal-name">{t('legalName')}</Label>
        <Input
          id="bank-legal-name"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          required
          maxLength={1024}
          disabled={isSubmitting}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bank-contact-email">{t('contactEmail')}</Label>
        <Input
          id="bank-contact-email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t('endorsementsLabel')}</legend>
        <p className="text-sm text-muted-foreground">{t('endorsementsHint')}</p>
        <div className="flex flex-col gap-2">
          {BANK_CURRENCY_METAS.map((meta) => {
            const inputId = `bank-rail-${meta.currency}`;
            const checked = requestedRails.includes(meta.currency);
            return (
              <label
                key={meta.currency}
                htmlFor={inputId}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  disabled={isSubmitting}
                  onCheckedChange={(value) =>
                    toggleRail(meta.currency, value === true)
                  }
                />
                <span>
                  {meta.flagEmoji} {tCurrencies(meta.nameKey)}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </form>
  );
};
