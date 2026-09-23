'use client';

import { FC, FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Input, Label } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { isBypassEligible } from '@hypha-platform/core/client';

import {
  BANK_ONBOARDING_CURRENCY_METAS,
  getDefaultBankCurrencyCodes,
  type BankOnboardingCurrencyCode,
} from '../bank-currency-display';
import {
  areOnboardingFieldsComplete,
  getDynamicOnboardingFields,
  getEnabledOnboardingCurrencies,
  ownerText,
  resolveOnboardingCurrencyProviders,
  type BankingOwnerContext,
} from '../banking-ui';
import { CurrencyOptionRow } from './currency-option-row';
import { OnboardingFieldsForm } from './onboarding-fields-form';

export type BankingInitialSetupProps = {
  initialLegalName: string;
  initialContactEmail: string;
  isSubmitting: boolean;
  error: string | null;
  /** Whether this setup is for a space or an individual member's profile. Defaults to 'space'. */
  ownerContext?: BankingOwnerContext;
  onSubmit: (input: {
    legalName: string;
    contactEmail: string;
    currencies: BankOnboardingCurrencyCode[];
    onboardingFields: Record<string, string>;
  }) => Promise<void>;
};

const enabledOnboardingCurrencies = new Set(getEnabledOnboardingCurrencies());
const ONBOARDING_CURRENCY_METAS = BANK_ONBOARDING_CURRENCY_METAS.filter((m) =>
  enabledOnboardingCurrencies.has(m.currency),
);

function getDefaultEnabledCurrencyCodes(): BankOnboardingCurrencyCode[] {
  return getDefaultBankCurrencyCodes().filter((c) =>
    enabledOnboardingCurrencies.has(c),
  );
}

export const BankingInitialSetup: FC<BankingInitialSetupProps> = ({
  initialLegalName,
  initialContactEmail,
  isSubmitting,
  error,
  ownerContext = 'space',
  onSubmit,
}) => {
  const t = useTranslations('BankingTab.initialSetup');
  const tOpen = useTranslations('BankingTab.openAccount');
  const ot = (key: string) => ownerText(t, ownerContext, key);

  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [selected, setSelected] = useState<BankOnboardingCurrencyCode[]>(() =>
    getDefaultEnabledCurrencyCodes(),
  );
  const [onboardingFieldValues, setOnboardingFieldValues] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setLegalName(initialLegalName.trim());
    setContactEmail(initialContactEmail.trim());
    setSelected(getDefaultEnabledCurrencyCodes());
    setOnboardingFieldValues({});
  }, [initialContactEmail, initialLegalName]);

  const toggleCurrency = (
    currency: BankOnboardingCurrencyCode,
    checked: boolean,
  ) => {
    setSelected((current) => {
      if (!checked) {
        return current.filter((c) => c !== currency);
      }
      // Onboarding is one-provider-per-call (D2/D3) — the server rejects a mixed-provider
      // `requestedRails` set. Selecting a currency from a different provider than what's already
      // picked starts a fresh selection instead of mixing (e.g. checking `aud` while Bridge
      // currencies are still selected drops them, rather than producing a submission that would
      // fail server-side).
      const [currentProvider] =
        current.length > 0 ? resolveOnboardingCurrencyProviders(current) : [];
      const [newProvider] = resolveOnboardingCurrencyProviders([currency]);
      if (currentProvider && newProvider && currentProvider !== newProvider) {
        return [currency];
      }
      return [...current, currency];
    });
  };

  // `contactEmail`/`legalName` already ride the fixed organization-details inputs above — the
  // dynamic section only needs to add whatever else a resolved provider declares (D10).
  const dynamicFields = getDynamicOnboardingFields(selected);

  const handleOnboardingFieldChange = (key: string, value: string) => {
    setOnboardingFieldValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      selected.length === 0 ||
      !legalName.trim() ||
      !contactEmail.trim() ||
      !areOnboardingFieldsComplete(dynamicFields, onboardingFieldValues)
    ) {
      return;
    }

    // Drop values left over from a currency that's since been deselected — they'd otherwise ride
    // along in the encrypted confirmation token for no reason (adapters ignore unknown keys, but
    // there's no reason to carry stale form data that far).
    const activeOnboardingFields = Object.fromEntries(
      Object.entries(onboardingFieldValues).filter(([key]) =>
        dynamicFields.some((field) => field.key === key),
      ),
    );

    await onSubmit({
      legalName: legalName.trim(),
      contactEmail: contactEmail.trim(),
      currencies: selected,
      onboardingFields: activeOnboardingFields,
    });
  };

  const canSubmit =
    selected.length > 0 &&
    Boolean(legalName.trim()) &&
    Boolean(contactEmail.trim()) &&
    areOnboardingFieldsComplete(dynamicFields, onboardingFieldValues);

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
            {ot('organizationLegend')}
          </h2>
          <p className="text-2 text-muted-foreground">
            {ot('organizationHint')}
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="banking-setup-legal-name"
              className="text-foreground"
            >
              {ot('legalName')}
            </Label>
            <Input
              id="banking-setup-legal-name"
              className="text-foreground"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              required
              maxLength={1024}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="banking-setup-email" className="text-foreground">
              {t('contactEmail')}
            </Label>
            <Input
              id="banking-setup-email"
              className="text-foreground"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
            <p className="text-1 text-muted-foreground">
              {isBypassEligible(initialContactEmail, contactEmail)
                ? t('bypassEligibleHint')
                : t('confirmationRequiredHint')}
            </p>
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
            {ot('currenciesDescription')}
          </p>
          <p className="text-1 text-muted-foreground">{t('currenciesHint')}</p>
        </div>
        <div className="flex flex-col gap-2">
          {ONBOARDING_CURRENCY_METAS.map((meta) => (
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

      {dynamicFields.length > 0 ? (
        <section
          className="order-3 flex flex-col gap-4 lg:col-span-2 lg:row-start-2"
          aria-labelledby="banking-setup-provider-fields"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="banking-setup-provider-fields"
              className="text-3 font-semibold tracking-tight text-foreground"
            >
              {t('providerFieldsTitle')}
            </h2>
            <p className="text-2 text-muted-foreground">
              {t('providerFieldsHint')}
            </p>
          </div>
          <OnboardingFieldsForm
            fields={dynamicFields}
            values={onboardingFieldValues}
            onChange={handleOnboardingFieldChange}
            disabled={isSubmitting}
            idPrefix="banking-setup"
          />
        </section>
      ) : null}

      <div className="order-4 flex flex-col gap-3 lg:col-span-2 lg:row-start-3 lg:items-end">
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
