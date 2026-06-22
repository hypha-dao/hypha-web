'use client';

import { FC, FormEvent, ReactNode, useEffect, useId, useState } from 'react';
import { ArrowLeft, Globe, Loader2 } from 'lucide-react';
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

import { COUNTRIES, SEPA_COUNTRIES } from '../country-data';
import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import { AddressFormFields } from './address-form-fields';
import type {
  BankCustomerPublicStatus,
  BankPayoutAccountPublic,
  CreatePayoutAccountInput,
} from '../hooks/types';
import {
  BANKING_DIALOG_FOOTER_CLASS,
  BANKING_DIALOG_FORM_CONTENT_CLASS,
  BANKING_DIALOG_HEADER_CLASS,
  BankingDialogBody,
} from './banking-dialog-layout';
import { CurrencyFlagBadge } from './currency-flag-badge';
import {
  getEnabledPayoutCurrencyKeys,
  PAYOUT_RAIL_SOURCE_CURRENCIES,
  PayoutCurrencyOptionRow,
  payoutCurrencyToRailKey,
  type PayoutCurrencyKey,
} from './payout-currency-option-row';
import {
  getPayoutRailEndorsementStatus,
  isBankRailSelectable,
} from '../banking-ui';

const ADD_PAYOUT_FORM_ID = 'add-payout-account-form';

const ENABLED_PAYOUT_CURRENCIES = getEnabledPayoutCurrencyKeys();

function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + parseInt(ch, 10)) % 97;
  }
  return remainder === 1;
}

type AddPayoutAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  error: string | null;
  defaultAccountOwnerName?: string;
  defaultBusinessName?: string;
  /** Customer status used to gate rails by Bridge endorsement — mirrors the deposit-side check. */
  status?: BankCustomerPublicStatus | null;
  onSubmit: (
    input: CreatePayoutAccountInput,
  ) => Promise<BankPayoutAccountPublic>;
  onSuccess: (account: BankPayoutAccountPublic) => void;
};

function defaultSourceCurrency(currency: PayoutCurrencyKey): 'usdc' | 'eurc' {
  const supported = PAYOUT_RAIL_SOURCE_CURRENCIES[currency];
  return supported.includes('eurc') ? 'eurc' : 'usdc';
}

function PayoutSelectedCurrencyBadge({
  currency,
}: {
  currency: PayoutCurrencyKey;
}) {
  const tCurrencies = useTranslations('BankingTab.currencies');
  const tDialog = useTranslations('BankingTab.payouts.addDialog');

  if (currency === 'swift') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background-2 text-muted-foreground"
          aria-hidden
        >
          <Globe className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-2 font-semibold text-foreground">
            {tDialog('swift.code')}
          </span>
          <span className="text-1 text-muted-foreground">
            {tDialog('swift.hint')}
          </span>
        </span>
      </div>
    );
  }

  const meta = getBankCurrencyMeta(currency as BankCurrencyCode);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <CurrencyFlagBadge currency={currency as BankCurrencyCode} size="sm" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-2 font-semibold text-foreground">
          {meta ? tCurrencies(`${meta.nameKey}.code`) : currency.toUpperCase()}
        </span>
        {meta ? (
          <span className="text-1 text-muted-foreground">
            {tCurrencies(`${meta.nameKey}.payoutMethod`)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background-2/30 p-4">
      <p className="text-1 font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-2 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-2 font-medium text-foreground break-all">
        {value}
      </span>
    </div>
  );
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (!message) return null;
  return (
    <p id={id} className="text-1 text-destructive" role="alert">
      {message}
    </p>
  );
}

export const AddPayoutAccountDialog: FC<AddPayoutAccountDialogProps> = ({
  open,
  onOpenChange,
  isSubmitting,
  error,
  defaultAccountOwnerName = '',
  defaultBusinessName = '',
  status,
  onSubmit,
  onSuccess,
}) => {
  const t = useTranslations('BankingTab.payouts.addDialog');
  const REQUIRED_MSG = t('fieldRequired');
  const radioName = useId();

  const [step, setStep] = useState<
    'currency' | 'form' | 'compliance' | 'review'
  >('currency');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const firstSelectableCurrency =
    ENABLED_PAYOUT_CURRENCIES.find((c) =>
      isBankRailSelectable(
        getPayoutRailEndorsementStatus(payoutCurrencyToRailKey(c), status),
      ),
    ) ??
    ENABLED_PAYOUT_CURRENCIES[0] ??
    'usd';

  const [selectedCurrency, setSelectedCurrency] = useState<PayoutCurrencyKey>(
    firstSelectableCurrency,
  );
  const [sourceCurrency, setSourceCurrency] = useState<'usdc' | 'eurc'>('usdc');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountOwnerType, setAccountOwnerType] = useState<
    'business' | 'individual'
  >('business');
  const [accountOwnerName, setAccountOwnerName] = useState(
    defaultAccountOwnerName,
  );
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState(defaultBusinessName);
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [checkingOrSavings, setCheckingOrSavings] = useState<
    'checking' | 'savings'
  >('checking');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [streetLine1, setStreetLine1] = useState('');
  const [streetLine2, setStreetLine2] = useState('');
  const [city, setCity] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [swiftAccountFormat, setSwiftAccountFormat] = useState<
    'iban' | 'other'
  >('iban');
  const [swiftIbanCountry, setSwiftIbanCountry] = useState('');
  const [swiftBankStreet, setSwiftBankStreet] = useState('');
  const [swiftBankCity, setSwiftBankCity] = useState('');
  const [swiftBankPostal, setSwiftBankPostal] = useState('');
  const [swiftBankCountry, setSwiftBankCountry] = useState('');
  const [swiftBankState, setSwiftBankState] = useState('');
  const [swiftCategory, setSwiftCategory] = useState('');
  const [swiftPurposeOfFunds, setSwiftPurposeOfFunds] = useState<string[]>([]);
  const [swiftBusinessDescription, setSwiftBusinessDescription] = useState('');

  const clearRailSpecificFields = () => {
    setRoutingNumber('');
    setAccountNumber('');
    setCheckingOrSavings('checking');
    setIban('');
    setBic('');
    setSortCode('');
    setSwiftAccountFormat('iban');
    setSwiftIbanCountry('');
    setSwiftBankStreet('');
    setSwiftBankCity('');
    setSwiftBankPostal('');
    setSwiftBankCountry('');
    setSwiftBankState('');
    setSwiftCategory('');
    setSwiftPurposeOfFunds([]);
    setSwiftBusinessDescription('');
  };

  useEffect(() => {
    // Reset on close so the next open's first render is already clean (no flash of stale errors).
    if (open) return;

    setStep('currency');
    setSelectedCurrency(firstSelectableCurrency);
    setSourceCurrency('usdc');
    setBankName('');
    setAccountName('');
    setAccountOwnerType('business');
    setAccountOwnerName(defaultAccountOwnerName);
    setFirstName('');
    setLastName('');
    setBusinessName(defaultBusinessName);
    clearRailSpecificFields();
    setStreetLine1('');
    setStreetLine2('');
    setCity('');
    setSubdivision('');
    setPostalCode('');
    setCountry('');
    setFieldErrors({});
  }, [open, defaultAccountOwnerName, defaultBusinessName]);

  const railKey = payoutCurrencyToRailKey(selectedCurrency);
  const showUsFields = selectedCurrency === 'usd';
  const showIbanFields = selectedCurrency === 'eur';
  const showGbpFields = selectedCurrency === 'gbp';
  const isUsAddress = country === 'USA';

  const countryOptions =
    selectedCurrency === 'eur'
      ? SEPA_COUNTRIES
      : selectedCurrency === 'gbp'
      ? COUNTRIES.filter((c) => c.alpha3 === 'GBR')
      : selectedCurrency === 'usd'
      ? COUNTRIES.filter((c) => c.alpha3 === 'USA')
      : COUNTRIES;

  const clearFieldError = (key: string) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleCurrencySelect = (currency: PayoutCurrencyKey) => {
    if (currency !== selectedCurrency) {
      clearRailSpecificFields();
      setSourceCurrency(defaultSourceCurrency(currency));
      setCountry('');
    }
    setSelectedCurrency(currency);
  };

  const handleContinue = () => {
    setStep('form');
  };

  const handleBack = () => {
    if (step === 'form') {
      setFieldErrors({});
      setStep('currency');
    }
    if (step === 'compliance') {
      setFieldErrors({});
      setStep('form');
    }
    if (step === 'review') {
      setFieldErrors({});
      setStep('compliance');
    }
  };

  // Step 2 validation: bank account details + account holder.
  const handleFormContinue = (event?: FormEvent) => {
    event?.preventDefault();
    const errs: Record<string, string> = {};

    if (!accountName.trim()) errs.accountName = REQUIRED_MSG;
    if (!bankName.trim()) errs.bankName = REQUIRED_MSG;

    if (showUsFields) {
      // USD ACH/Wire: only account_owner_name, 3–35 chars per Bridge constraint
      if (!accountOwnerName.trim()) {
        errs.accountOwnerName = REQUIRED_MSG;
      } else if (
        accountOwnerName.trim().length < 3 ||
        accountOwnerName.trim().length > 35
      ) {
        errs.accountOwnerName = 'Must be 3–35 characters for US accounts';
      }
    } else if (accountOwnerType === 'individual') {
      if (!firstName.trim()) errs.firstName = REQUIRED_MSG;
      if (!lastName.trim()) errs.lastName = REQUIRED_MSG;
    } else {
      if (!accountOwnerName.trim()) errs.accountOwnerName = REQUIRED_MSG;
      if (!businessName.trim()) errs.businessName = REQUIRED_MSG;
    }

    if (showUsFields) {
      if (!routingNumber.trim()) errs.routingNumber = REQUIRED_MSG;
      if (!accountNumber.trim()) errs.accountNumber = REQUIRED_MSG;
    }
    if (showGbpFields) {
      if (!sortCode.trim()) {
        errs.sortCode = REQUIRED_MSG;
      } else if (!/^\d{6}$/.test(sortCode)) {
        errs.sortCode = 'Must be exactly 6 digits';
      }
      if (!accountNumber.trim()) {
        errs.accountNumber = REQUIRED_MSG;
      } else if (!/^\d{8}$/.test(accountNumber)) {
        errs.accountNumber = 'Must be exactly 8 digits';
      }
    }
    if (selectedCurrency === 'eur') {
      if (!iban.trim()) {
        errs.iban = REQUIRED_MSG;
      } else if (!isValidIban(iban.trim().replace(/\s/g, ''))) {
        errs.iban = t('invalidIban');
      }
    } else if (selectedCurrency === 'swift') {
      if (swiftAccountFormat === 'iban') {
        if (!iban.trim()) {
          errs.iban = REQUIRED_MSG;
        } else if (!isValidIban(iban.trim().replace(/\s/g, ''))) {
          errs.iban = t('invalidIban');
        }
        if (!swiftIbanCountry) errs.swiftIbanCountry = REQUIRED_MSG;
      } else {
        if (!accountNumber.trim()) errs.accountNumber = REQUIRED_MSG;
        if (!bic.trim()) errs.bic = REQUIRED_MSG;
      }
      if (!swiftBankStreet.trim()) errs.swiftBankStreet = REQUIRED_MSG;
      if (!swiftBankCity.trim()) errs.swiftBankCity = REQUIRED_MSG;
      if (!swiftBankCountry) errs.swiftBankCountry = REQUIRED_MSG;
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setStep('compliance');
  };

  // Step 3 validation: beneficiary address + SWIFT transfer details.
  const handleComplianceContinue = () => {
    const errs: Record<string, string> = {};

    if (!streetLine1.trim()) errs.street = REQUIRED_MSG;
    if (!city.trim()) errs.city = REQUIRED_MSG;
    if (!postalCode.trim()) errs.postal = REQUIRED_MSG;
    if (!country) errs.country = REQUIRED_MSG;
    if (isUsAddress && !subdivision.trim()) errs.subdivision = REQUIRED_MSG;

    if (selectedCurrency === 'swift') {
      if (!swiftCategory) errs.swiftCategory = REQUIRED_MSG;
      if (swiftPurposeOfFunds.length === 0)
        errs.swiftPurposeOfFunds = REQUIRED_MSG;
      if (!swiftBusinessDescription.trim())
        errs.swiftBusinessDescription = REQUIRED_MSG;
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setStep('review');
  };

  // Fires the actual POST from the review step.
  const handleConfirmSubmit = async () => {
    try {
      const account = await onSubmit({
        railKey,
        sourceCurrency,
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountOwnerName: showUsFields
          ? accountOwnerName.trim()
          : accountOwnerType === 'individual'
          ? `${firstName.trim()} ${lastName.trim()}`.trim()
          : accountOwnerName.trim(),
        accountOwnerType: showUsFields ? undefined : accountOwnerType,
        firstName:
          !showUsFields && accountOwnerType === 'individual'
            ? firstName.trim()
            : undefined,
        lastName:
          !showUsFields && accountOwnerType === 'individual'
            ? lastName.trim()
            : undefined,
        businessName:
          !showUsFields && accountOwnerType === 'business'
            ? businessName.trim() || accountOwnerName.trim()
            : undefined,
        routingNumber: routingNumber.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        checkingOrSavings: showUsFields ? checkingOrSavings : undefined,
        iban: iban.trim().replace(/\s/g, '') || undefined,
        bic: bic.trim().toUpperCase() || undefined,
        sortCode: sortCode.trim() || undefined,
        swiftAccountFormat:
          selectedCurrency === 'swift' ? swiftAccountFormat : undefined,
        swiftIbanCountry:
          selectedCurrency === 'swift' && swiftAccountFormat === 'iban'
            ? swiftIbanCountry
            : undefined,
        swiftBankAddress:
          selectedCurrency === 'swift'
            ? {
                street_line_1: swiftBankStreet.trim(),
                city: swiftBankCity.trim(),
                postal_code: swiftBankPostal.trim() || undefined,
                country: swiftBankCountry,
                state: swiftBankState.trim() || undefined,
              }
            : undefined,
        swiftCategory: selectedCurrency === 'swift' ? swiftCategory : undefined,
        swiftPurposeOfFunds:
          selectedCurrency === 'swift' ? swiftPurposeOfFunds : undefined,
        swiftBusinessDescription:
          selectedCurrency === 'swift'
            ? swiftBusinessDescription.trim()
            : undefined,
        address: {
          street_line_1: streetLine1.trim(),
          street_line_2: streetLine2.trim() || undefined,
          city: city.trim(),
          subdivision: subdivision.trim() || undefined,
          postal_code: postalCode.trim(),
          country: country.trim(),
        },
      });
      onSuccess(account);
    } catch {
      // parent sets error prop; stay on review step
    }
  };

  const countryName =
    COUNTRIES.find((c) => c.alpha3 === country)?.name ?? country;

  const inputErrorClass = (key: string) =>
    fieldErrors[key]
      ? 'border-destructive ring-1 ring-destructive focus-visible:ring-destructive'
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(BANKING_DIALOG_FORM_CONTENT_CLASS, 'max-w-md')}
      >
        <DialogHeader className={BANKING_DIALOG_HEADER_CLASS}>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {step === 'currency'
              ? t('step1Description')
              : step === 'form'
              ? t('step2Description')
              : step === 'compliance'
              ? t('step3Description')
              : t('step4Description')}
          </DialogDescription>
        </DialogHeader>

        <BankingDialogBody>
          {step === 'currency' ? (
            <div className="flex flex-col gap-4">
              <p className="text-right text-1 text-muted-foreground">
                {t('stepOf', { current: '1', total: '4' })}
              </p>
              <div className="flex flex-col gap-2">
                <Label>{t('currencyLabel')}</Label>
                <p className="text-1 text-muted-foreground">
                  {t('currencyHint')}
                </p>
                <div className="flex flex-col gap-2">
                  {ENABLED_PAYOUT_CURRENCIES.map((currency) => {
                    const railKey = payoutCurrencyToRailKey(currency);
                    const endorsementStatus = getPayoutRailEndorsementStatus(
                      railKey,
                      status,
                    );
                    const railSelectable =
                      isBankRailSelectable(endorsementStatus);
                    return (
                      <PayoutCurrencyOptionRow
                        key={currency}
                        currency={currency}
                        selected={selectedCurrency === currency}
                        disabled={isSubmitting || !railSelectable}
                        radioName={radioName}
                        onSelect={() =>
                          railSelectable && handleCurrencySelect(currency)
                        }
                      />
                    );
                  })}
                </div>
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : step === 'form' ? (
            // noValidate disables all browser-native required/invalid validation;
            // we run manual checks in handleFormContinue instead.
            <form
              id={ADD_PAYOUT_FORM_ID}
              onSubmit={handleFormContinue}
              noValidate
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto w-fit gap-1.5 px-0 py-1 text-2 text-muted-foreground hover:text-foreground"
                  disabled={isSubmitting}
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('back')}
                </Button>
                <span className="text-1 text-muted-foreground">
                  {t('stepOf', { current: '2', total: '4' })}
                </span>
              </div>

              <PayoutSelectedCurrencyBadge currency={selectedCurrency} />

              <div className="flex flex-col gap-2">
                <Label htmlFor="payout-account-name">{t('accountName')}</Label>
                <Input
                  id="payout-account-name"
                  value={accountName}
                  onChange={(event) => {
                    setAccountName(event.target.value);
                    clearFieldError('accountName');
                  }}
                  placeholder={t('accountNamePlaceholder')}
                  disabled={isSubmitting}
                  aria-invalid={fieldErrors.accountName ? true : undefined}
                  aria-describedby={
                    fieldErrors.accountName ? 'err-accountName' : undefined
                  }
                  className={cn(inputErrorClass('accountName'))}
                />
                <FieldError
                  id="err-accountName"
                  message={fieldErrors.accountName}
                />
                <p className="text-1 text-muted-foreground">
                  {t('accountNameHint')}
                </p>
              </div>

              {/* Source token */}
              <FormSection title={t('sourceCurrencySection')}>
                <p className="text-1 text-muted-foreground">
                  {t('sourceCurrencyHint')}
                </p>
                <div
                  className="flex gap-2"
                  role="radiogroup"
                  aria-label={t('sourceCurrencyLabel')}
                >
                  {PAYOUT_RAIL_SOURCE_CURRENCIES[selectedCurrency].map(
                    (token) => (
                      <button
                        key={token}
                        type="button"
                        disabled={isSubmitting}
                        className={cn(
                          'rounded-md border px-3 py-2 text-2 font-medium transition-colors',
                          sourceCurrency === token
                            ? 'border-accent-9 bg-accent-9 text-accent-contrast shadow-sm'
                            : 'border-border bg-card text-foreground hover:bg-background-2/80',
                          isSubmitting && 'cursor-not-allowed opacity-60',
                        )}
                        onClick={() => setSourceCurrency(token)}
                      >
                        {token.toUpperCase()}
                      </button>
                    ),
                  )}
                </div>
              </FormSection>

              {/* Bank account details */}
              <FormSection title={t('bankAccountSection')}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payout-bank-name">{t('bankName')}</Label>
                  <Input
                    id="payout-bank-name"
                    value={bankName}
                    onChange={(event) => {
                      setBankName(event.target.value);
                      clearFieldError('bankName');
                    }}
                    placeholder={t('bankNamePlaceholder')}
                    disabled={isSubmitting}
                    aria-invalid={fieldErrors.bankName ? true : undefined}
                    aria-describedby={
                      fieldErrors.bankName ? 'err-bankName' : undefined
                    }
                    className={cn(inputErrorClass('bankName'))}
                  />
                  <FieldError
                    id="err-bankName"
                    message={fieldErrors.bankName}
                  />
                </div>

                {showUsFields ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="payout-routing">
                          {t('routingNumber')}
                        </Label>
                        <Input
                          id="payout-routing"
                          value={routingNumber}
                          onChange={(event) => {
                            setRoutingNumber(
                              event.target.value.replace(/\D/g, '').slice(0, 9),
                            );
                            clearFieldError('routingNumber');
                          }}
                          placeholder={t('routingNumberPlaceholder')}
                          inputMode="numeric"
                          maxLength={9}
                          disabled={isSubmitting}
                          aria-invalid={
                            fieldErrors.routingNumber ? true : undefined
                          }
                          aria-describedby={
                            fieldErrors.routingNumber
                              ? 'err-routingNumber'
                              : undefined
                          }
                          className={cn(inputErrorClass('routingNumber'))}
                        />
                        <FieldError
                          id="err-routingNumber"
                          message={fieldErrors.routingNumber}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="payout-account-number">
                          {t('accountNumber')}
                        </Label>
                        <Input
                          id="payout-account-number"
                          value={accountNumber}
                          onChange={(event) => {
                            setAccountNumber(event.target.value);
                            clearFieldError('accountNumber');
                          }}
                          placeholder={t('accountNumberPlaceholder')}
                          inputMode="numeric"
                          disabled={isSubmitting}
                          aria-invalid={
                            fieldErrors.accountNumber ? true : undefined
                          }
                          aria-describedby={
                            fieldErrors.accountNumber
                              ? 'err-accountNumber'
                              : undefined
                          }
                          className={cn(inputErrorClass('accountNumber'))}
                        />
                        <FieldError
                          id="err-accountNumber"
                          message={fieldErrors.accountNumber}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>{t('checkingOrSavings')}</Label>
                      <div className="flex gap-2" role="radiogroup">
                        {(['checking', 'savings'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            disabled={isSubmitting}
                            className={cn(
                              'rounded-md border px-3 py-2 text-2 font-medium transition-colors',
                              checkingOrSavings === type
                                ? 'border-accent-9 bg-accent-9 text-accent-contrast shadow-sm'
                                : 'border-border bg-card text-foreground hover:bg-background-2/80',
                              isSubmitting && 'cursor-not-allowed opacity-60',
                            )}
                            onClick={() => setCheckingOrSavings(type)}
                          >
                            {type === 'checking'
                              ? t('checkingOrSavingsChecking')
                              : t('checkingOrSavingsSavings')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {showGbpFields ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payout-sort-code">{t('sortCode')}</Label>
                      <Input
                        id="payout-sort-code"
                        value={sortCode}
                        onChange={(event) => {
                          setSortCode(
                            event.target.value.replace(/\D/g, '').slice(0, 6),
                          );
                          clearFieldError('sortCode');
                        }}
                        placeholder={t('sortCodePlaceholder')}
                        inputMode="numeric"
                        maxLength={6}
                        disabled={isSubmitting}
                        aria-invalid={fieldErrors.sortCode ? true : undefined}
                        aria-describedby={
                          fieldErrors.sortCode ? 'err-sortCode' : undefined
                        }
                        className={cn(inputErrorClass('sortCode'))}
                      />
                      <FieldError
                        id="err-sortCode"
                        message={fieldErrors.sortCode}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payout-gbp-account">
                        {t('accountNumber')}
                      </Label>
                      <Input
                        id="payout-gbp-account"
                        value={accountNumber}
                        onChange={(event) => {
                          setAccountNumber(
                            event.target.value.replace(/\D/g, '').slice(0, 8),
                          );
                          clearFieldError('accountNumber');
                        }}
                        placeholder={t('gbpAccountNumberPlaceholder')}
                        inputMode="numeric"
                        maxLength={8}
                        disabled={isSubmitting}
                        aria-invalid={
                          fieldErrors.accountNumber ? true : undefined
                        }
                        aria-describedby={
                          fieldErrors.accountNumber
                            ? 'err-accountNumber'
                            : undefined
                        }
                        className={cn(inputErrorClass('accountNumber'))}
                      />
                      <FieldError
                        id="err-accountNumber"
                        message={fieldErrors.accountNumber}
                      />
                    </div>
                  </div>
                ) : null}

                {showIbanFields ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payout-iban">{t('iban')}</Label>
                    <Input
                      id="payout-iban"
                      value={iban}
                      onChange={(event) => {
                        setIban(event.target.value.toUpperCase());
                        clearFieldError('iban');
                      }}
                      placeholder={t('ibanPlaceholder')}
                      disabled={isSubmitting}
                      aria-invalid={fieldErrors.iban ? true : undefined}
                      aria-describedby={
                        fieldErrors.iban ? 'err-iban' : undefined
                      }
                      className={cn(inputErrorClass('iban'))}
                    />
                    <FieldError id="err-iban" message={fieldErrors.iban} />
                  </div>
                ) : null}

                {selectedCurrency === 'swift' ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <Label>{t('swift.accountFormatLabel')}</Label>
                      <div
                        className="flex gap-2"
                        role="radiogroup"
                        aria-label={t('swift.accountFormatLabel')}
                      >
                        {(['iban', 'other'] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            disabled={isSubmitting}
                            className={cn(
                              'rounded-md border px-3 py-2 text-2 font-medium transition-colors',
                              swiftAccountFormat === fmt
                                ? 'border-accent-9 bg-accent-9 text-accent-contrast shadow-sm'
                                : 'border-border bg-card text-foreground hover:bg-background-2/80',
                              isSubmitting && 'cursor-not-allowed opacity-60',
                            )}
                            onClick={() => {
                              setSwiftAccountFormat(fmt);
                              setIban('');
                              setAccountNumber('');
                              setBic('');
                              clearFieldError('iban');
                              clearFieldError('accountNumber');
                              clearFieldError('bic');
                            }}
                          >
                            {fmt === 'iban'
                              ? t('swift.accountFormatIban')
                              : t('swift.accountFormatOther')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {swiftAccountFormat === 'iban' ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="payout-swift-iban">{t('iban')}</Label>
                          <Input
                            id="payout-swift-iban"
                            value={iban}
                            onChange={(event) => {
                              setIban(event.target.value.toUpperCase());
                              clearFieldError('iban');
                            }}
                            placeholder={t('ibanPlaceholder')}
                            disabled={isSubmitting}
                            aria-invalid={fieldErrors.iban ? true : undefined}
                            aria-describedby={
                              fieldErrors.iban ? 'err-iban' : undefined
                            }
                            className={cn(inputErrorClass('iban'))}
                          />
                          <FieldError
                            id="err-iban"
                            message={fieldErrors.iban}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="payout-swift-iban-country">
                            {t('country')}
                          </Label>
                          <div className="relative flex min-h-6 w-full items-center">
                            <select
                              id="payout-swift-iban-country"
                              className={cn(
                                'min-h-6 w-full appearance-none rounded border border-input bg-neutral-1 px-3 py-2 text-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                                fieldErrors.swiftIbanCountry &&
                                  'border-destructive ring-2 ring-destructive',
                              )}
                              value={swiftIbanCountry}
                              onChange={(event) => {
                                setSwiftIbanCountry(event.target.value);
                                clearFieldError('swiftIbanCountry');
                              }}
                              disabled={isSubmitting}
                              aria-invalid={
                                fieldErrors.swiftIbanCountry ? true : undefined
                              }
                              aria-describedby={
                                fieldErrors.swiftIbanCountry
                                  ? 'err-swiftIbanCountry'
                                  : undefined
                              }
                            >
                              <option value="">
                                {t('countryPlaceholder')}
                              </option>
                              {COUNTRIES.map((c) => (
                                <option key={c.alpha3} value={c.alpha3}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <FieldError
                            id="err-swiftIbanCountry"
                            message={fieldErrors.swiftIbanCountry}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="payout-swift-account">
                          {t('swift.accountNumber')}
                        </Label>
                        <Input
                          id="payout-swift-account"
                          value={accountNumber}
                          onChange={(event) => {
                            setAccountNumber(event.target.value);
                            clearFieldError('accountNumber');
                          }}
                          placeholder={t('swift.accountNumberPlaceholder')}
                          disabled={isSubmitting}
                          aria-invalid={
                            fieldErrors.accountNumber ? true : undefined
                          }
                          aria-describedby={
                            fieldErrors.accountNumber
                              ? 'err-accountNumber'
                              : undefined
                          }
                          className={cn(inputErrorClass('accountNumber'))}
                        />
                        <FieldError
                          id="err-accountNumber"
                          message={fieldErrors.accountNumber}
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payout-bic">{t('bic')}</Label>
                      <Input
                        id="payout-bic"
                        value={bic}
                        onChange={(event) => {
                          setBic(event.target.value.toUpperCase());
                          clearFieldError('bic');
                        }}
                        placeholder={t('bicPlaceholder')}
                        maxLength={11}
                        disabled={isSubmitting}
                        aria-invalid={fieldErrors.bic ? true : undefined}
                        aria-describedby={
                          fieldErrors.bic ? 'err-bic' : undefined
                        }
                        className={cn(inputErrorClass('bic'))}
                      />
                      <FieldError id="err-bic" message={fieldErrors.bic} />
                    </div>
                  </div>
                ) : null}
              </FormSection>

              {/* Account holder */}
              <FormSection title={t('accountHolderSection')}>
                {showUsFields ? (
                  // USD ACH/Wire: Bridge only needs account_owner_name (3–35 chars)
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payout-owner-name">
                      {t('accountOwnerName')}
                    </Label>
                    <Input
                      id="payout-owner-name"
                      value={accountOwnerName}
                      onChange={(event) => {
                        setAccountOwnerName(event.target.value);
                        clearFieldError('accountOwnerName');
                      }}
                      maxLength={35}
                      disabled={isSubmitting}
                      aria-invalid={
                        fieldErrors.accountOwnerName ? true : undefined
                      }
                      aria-describedby={
                        fieldErrors.accountOwnerName
                          ? 'err-accountOwnerName'
                          : undefined
                      }
                      className={cn(inputErrorClass('accountOwnerName'))}
                    />
                    <FieldError
                      id="err-accountOwnerName"
                      message={fieldErrors.accountOwnerName}
                    />
                  </div>
                ) : (
                  <>
                    <div
                      className="flex gap-2"
                      role="radiogroup"
                      aria-label={t('ownerTypeLabel')}
                    >
                      {(['business', 'individual'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          disabled={isSubmitting}
                          className={cn(
                            'rounded-md border px-3 py-2 text-2 font-medium transition-colors',
                            accountOwnerType === type
                              ? 'border-accent-9 bg-accent-9 text-accent-contrast shadow-sm'
                              : 'border-border bg-card text-foreground hover:bg-background-2/80',
                            isSubmitting && 'cursor-not-allowed opacity-60',
                          )}
                          onClick={() => {
                            setAccountOwnerType(type);
                            setFirstName('');
                            setLastName('');
                            setBusinessName('');
                            clearFieldError('firstName');
                            clearFieldError('lastName');
                            clearFieldError('businessName');
                          }}
                        >
                          {type === 'business'
                            ? t('ownerTypeBusiness')
                            : t('ownerTypeIndividual')}
                        </button>
                      ))}
                    </div>
                    {accountOwnerType === 'individual' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="payout-first-name">
                            {t('firstName')}
                          </Label>
                          <Input
                            id="payout-first-name"
                            value={firstName}
                            onChange={(event) => {
                              setFirstName(event.target.value);
                              clearFieldError('firstName');
                            }}
                            disabled={isSubmitting}
                            aria-invalid={
                              fieldErrors.firstName ? true : undefined
                            }
                            aria-describedby={
                              fieldErrors.firstName
                                ? 'err-firstName'
                                : undefined
                            }
                            className={cn(inputErrorClass('firstName'))}
                          />
                          <FieldError
                            id="err-firstName"
                            message={fieldErrors.firstName}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="payout-last-name">
                            {t('lastName')}
                          </Label>
                          <Input
                            id="payout-last-name"
                            value={lastName}
                            onChange={(event) => {
                              setLastName(event.target.value);
                              clearFieldError('lastName');
                            }}
                            disabled={isSubmitting}
                            aria-invalid={
                              fieldErrors.lastName ? true : undefined
                            }
                            aria-describedby={
                              fieldErrors.lastName ? 'err-lastName' : undefined
                            }
                            className={cn(inputErrorClass('lastName'))}
                          />
                          <FieldError
                            id="err-lastName"
                            message={fieldErrors.lastName}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="payout-owner-name">
                            {t('accountOwnerName')}
                          </Label>
                          <Input
                            id="payout-owner-name"
                            value={accountOwnerName}
                            onChange={(event) => {
                              setAccountOwnerName(event.target.value);
                              clearFieldError('accountOwnerName');
                            }}
                            disabled={isSubmitting}
                            aria-invalid={
                              fieldErrors.accountOwnerName ? true : undefined
                            }
                            aria-describedby={
                              fieldErrors.accountOwnerName
                                ? 'err-accountOwnerName'
                                : undefined
                            }
                            className={cn(inputErrorClass('accountOwnerName'))}
                          />
                          <FieldError
                            id="err-accountOwnerName"
                            message={fieldErrors.accountOwnerName}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="payout-business-name">
                            {t('businessName')}
                          </Label>
                          <Input
                            id="payout-business-name"
                            value={businessName}
                            onChange={(event) => {
                              setBusinessName(event.target.value);
                              clearFieldError('businessName');
                            }}
                            disabled={isSubmitting}
                            aria-invalid={
                              fieldErrors.businessName ? true : undefined
                            }
                            aria-describedby={
                              fieldErrors.businessName
                                ? 'err-businessName'
                                : undefined
                            }
                            className={cn(inputErrorClass('businessName'))}
                          />
                          <FieldError
                            id="err-businessName"
                            message={fieldErrors.businessName}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </FormSection>

              {/* SWIFT bank address */}
              {selectedCurrency === 'swift' ? (
                <FormSection title={t('swift.bankAddressSection')}>
                  <AddressFormFields
                    idPrefix="swift-bank"
                    streetLine1={swiftBankStreet}
                    onStreetLine1Change={setSwiftBankStreet}
                    city={swiftBankCity}
                    onCityChange={setSwiftBankCity}
                    postalCode={swiftBankPostal}
                    onPostalCodeChange={setSwiftBankPostal}
                    postalRequired={false}
                    country={swiftBankCountry}
                    onCountryChange={(c) => {
                      setSwiftBankCountry(c);
                      setSwiftBankState('');
                    }}
                    countryOptions={COUNTRIES}
                    subdivision={swiftBankState}
                    onSubdivisionChange={setSwiftBankState}
                    subdivisionRequired={false}
                    disabled={isSubmitting}
                    fieldErrors={fieldErrors}
                    onClearFieldError={clearFieldError}
                    errorKeys={{
                      street: 'swiftBankStreet',
                      city: 'swiftBankCity',
                      country: 'swiftBankCountry',
                    }}
                  />
                </FormSection>
              ) : null}
            </form>
          ) : step === 'compliance' ? (
            // Step 3 — beneficiary address + transfer details
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto w-fit gap-1.5 px-0 py-1 text-2 text-muted-foreground hover:text-foreground"
                  disabled={isSubmitting}
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('back')}
                </Button>
                <span className="text-1 text-muted-foreground">
                  {t('stepOf', { current: '3', total: '4' })}
                </span>
              </div>

              {/* Account holder context badge */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-1 text-muted-foreground">
                    {t('accountHolderSection')}
                  </span>
                  <span className="text-2 font-semibold text-foreground">
                    {showUsFields
                      ? accountOwnerName.trim()
                      : accountOwnerType === 'business'
                      ? businessName.trim() || accountOwnerName.trim()
                      : `${firstName.trim()} ${lastName.trim()}`.trim()}
                  </span>
                </span>
              </div>

              {/* Beneficiary address */}
              <FormSection title={t('addressSection')}>
                <AddressFormFields
                  idPrefix="beneficiary"
                  streetLine1={streetLine1}
                  onStreetLine1Change={setStreetLine1}
                  streetLine2={streetLine2}
                  onStreetLine2Change={setStreetLine2}
                  city={city}
                  onCityChange={setCity}
                  postalCode={postalCode}
                  onPostalCodeChange={setPostalCode}
                  country={country}
                  onCountryChange={(c) => {
                    setCountry(c);
                    setSubdivision('');
                  }}
                  countryOptions={countryOptions}
                  subdivision={subdivision}
                  onSubdivisionChange={setSubdivision}
                  subdivisionLabel={
                    isUsAddress ? t('subdivisionUs') : t('subdivision')
                  }
                  subdivisionRequired={isUsAddress}
                  disabled={isSubmitting}
                  fieldErrors={fieldErrors}
                  onClearFieldError={clearFieldError}
                />
              </FormSection>

              {/* SWIFT transfer details */}
              {selectedCurrency === 'swift' ? (
                <FormSection title={t('swift.complianceSection')}>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="swift-category">
                      {t('swift.categoryLabel')}
                    </Label>
                    <div className="relative flex min-h-6 w-full items-center">
                      <select
                        id="swift-category"
                        className={cn(
                          'min-h-6 w-full appearance-none rounded border border-input bg-neutral-1 px-3 py-2 text-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                          fieldErrors.swiftCategory &&
                            'border-destructive ring-2 ring-destructive',
                        )}
                        value={swiftCategory}
                        onChange={(event) => {
                          setSwiftCategory(event.target.value);
                          clearFieldError('swiftCategory');
                        }}
                        disabled={isSubmitting}
                        aria-invalid={
                          fieldErrors.swiftCategory ? true : undefined
                        }
                        aria-describedby={
                          fieldErrors.swiftCategory
                            ? 'err-swiftCategory'
                            : undefined
                        }
                      >
                        <option value="">
                          {t('swift.categoryPlaceholder')}
                        </option>
                        <option value="client">
                          {t('swift.categoryClient')}
                        </option>
                        <option value="parent_company">
                          {t('swift.categoryParentCompany')}
                        </option>
                        <option value="subsidiary">
                          {t('swift.categorySubsidiary')}
                        </option>
                        <option value="supplier">
                          {t('swift.categorySupplier')}
                        </option>
                      </select>
                    </div>
                    <FieldError
                      id="err-swiftCategory"
                      message={fieldErrors.swiftCategory}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>{t('swift.purposeLabel')}</Label>
                    <FieldError
                      id="err-swiftPurposeOfFunds"
                      message={fieldErrors.swiftPurposeOfFunds}
                    />
                    <div className="flex flex-col gap-2">
                      {(
                        [
                          {
                            value: 'intra_group_transfer',
                            labelKey: 'swift.purposeIntraGroup',
                          },
                          {
                            value: 'invoice_for_goods_and_services',
                            labelKey: 'swift.purposeInvoice',
                          },
                        ] as const
                      ).map((opt) => {
                        const checked = swiftPurposeOfFunds.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isSubmitting}
                              onChange={() => {
                                setSwiftPurposeOfFunds((prev) =>
                                  checked
                                    ? prev.filter((v) => v !== opt.value)
                                    : [...prev, opt.value],
                                );
                                clearFieldError('swiftPurposeOfFunds');
                              }}
                              className="h-4 w-4 rounded border-input"
                            />
                            <span className="text-2">{t(opt.labelKey)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="swift-description">
                      {t('swift.businessDescription')}
                    </Label>
                    <Input
                      id="swift-description"
                      value={swiftBusinessDescription}
                      onChange={(event) => {
                        setSwiftBusinessDescription(event.target.value);
                        clearFieldError('swiftBusinessDescription');
                      }}
                      placeholder={t('swift.businessDescriptionPlaceholder')}
                      disabled={isSubmitting}
                      aria-invalid={
                        fieldErrors.swiftBusinessDescription ? true : undefined
                      }
                      aria-describedby={
                        fieldErrors.swiftBusinessDescription
                          ? 'err-swiftBusinessDescription'
                          : undefined
                      }
                      className={cn(
                        inputErrorClass('swiftBusinessDescription'),
                      )}
                    />
                    <p className="text-1 text-muted-foreground">
                      {t('swift.businessDescriptionHint')}
                    </p>
                    <FieldError
                      id="err-swiftBusinessDescription"
                      message={fieldErrors.swiftBusinessDescription}
                    />
                  </div>
                </FormSection>
              ) : null}
            </div>
          ) : (
            // Step 4 — review
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto w-fit gap-1.5 px-0 py-1 text-2 text-muted-foreground hover:text-foreground"
                  disabled={isSubmitting}
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('back')}
                </Button>
                <span className="text-1 text-muted-foreground">
                  {t('stepOf', { current: '4', total: '4' })}
                </span>
              </div>

              <p className="text-2 text-muted-foreground">{t('reviewHint')}</p>

              <PayoutSelectedCurrencyBadge currency={selectedCurrency} />

              <FormSection title={t('sourceCurrencySection')}>
                <span className="w-fit rounded-md border border-border bg-card px-3 py-1.5 text-2 font-medium text-foreground">
                  {sourceCurrency.toUpperCase()}
                </span>
              </FormSection>

              <FormSection title={t('bankAccountSection')}>
                <ReviewRow label={t('bankName')} value={bankName} />
                {showUsFields && routingNumber ? (
                  <ReviewRow label={t('routingNumber')} value={routingNumber} />
                ) : null}
                {(showUsFields || showGbpFields) && accountNumber ? (
                  <ReviewRow label={t('accountNumber')} value={accountNumber} />
                ) : null}
                {showGbpFields && sortCode ? (
                  <ReviewRow label={t('sortCode')} value={sortCode} />
                ) : null}
                {showIbanFields && iban ? (
                  <ReviewRow label={t('iban')} value={iban} />
                ) : null}
                {selectedCurrency === 'swift' ? (
                  <>
                    <ReviewRow
                      label={t('swift.accountFormatLabel')}
                      value={
                        swiftAccountFormat === 'iban'
                          ? t('swift.accountFormatIban')
                          : t('swift.accountFormatOther')
                      }
                    />
                    {swiftAccountFormat === 'iban' && iban ? (
                      <ReviewRow label={t('iban')} value={iban} />
                    ) : null}
                    {swiftAccountFormat === 'iban' && swiftIbanCountry ? (
                      <ReviewRow
                        label={t('country')}
                        value={
                          COUNTRIES.find((c) => c.alpha3 === swiftIbanCountry)
                            ?.name ?? swiftIbanCountry
                        }
                      />
                    ) : null}
                    {swiftAccountFormat === 'other' && accountNumber ? (
                      <ReviewRow
                        label={t('swift.accountNumber')}
                        value={accountNumber}
                      />
                    ) : null}
                  </>
                ) : null}
                {bic ? <ReviewRow label={t('bic')} value={bic} /> : null}
              </FormSection>

              {selectedCurrency === 'swift' ? (
                <FormSection title={t('swift.bankAddressSection')}>
                  <p className="text-2 text-foreground">{swiftBankStreet}</p>
                  <p className="text-2 text-foreground">
                    {[swiftBankCity, swiftBankState, swiftBankPostal]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <p className="text-2 text-foreground">
                    {COUNTRIES.find((c) => c.alpha3 === swiftBankCountry)
                      ?.name ?? swiftBankCountry}
                  </p>
                </FormSection>
              ) : null}

              <FormSection title={t('accountHolderSection')}>
                {showUsFields ? (
                  accountOwnerName ? (
                    <ReviewRow
                      label={t('accountOwnerName')}
                      value={accountOwnerName}
                    />
                  ) : null
                ) : accountOwnerType === 'individual' ? (
                  <>
                    {firstName ? (
                      <ReviewRow label={t('firstName')} value={firstName} />
                    ) : null}
                    {lastName ? (
                      <ReviewRow label={t('lastName')} value={lastName} />
                    ) : null}
                  </>
                ) : (
                  <>
                    {accountOwnerName ? (
                      <ReviewRow
                        label={t('accountOwnerName')}
                        value={accountOwnerName}
                      />
                    ) : null}
                    {businessName ? (
                      <ReviewRow
                        label={t('businessName')}
                        value={businessName}
                      />
                    ) : null}
                  </>
                )}
              </FormSection>

              <FormSection title={t('addressSection')}>
                <p className="text-2 text-foreground">
                  {streetLine1}
                  {streetLine2 ? `, ${streetLine2}` : ''}
                </p>
                <p className="text-2 text-foreground">
                  {[city, subdivision, postalCode].filter(Boolean).join(', ')}
                </p>
                <p className="text-2 text-foreground">{countryName}</p>
              </FormSection>

              {selectedCurrency === 'swift' ? (
                <FormSection title={t('swift.complianceSection')}>
                  {swiftCategory ? (
                    <ReviewRow
                      label={t('swift.categoryLabel')}
                      value={
                        swiftCategory === 'client'
                          ? t('swift.categoryClient')
                          : swiftCategory === 'parent_company'
                          ? t('swift.categoryParentCompany')
                          : swiftCategory === 'subsidiary'
                          ? t('swift.categorySubsidiary')
                          : swiftCategory === 'supplier'
                          ? t('swift.categorySupplier')
                          : swiftCategory
                      }
                    />
                  ) : null}
                  {swiftPurposeOfFunds.length > 0 ? (
                    <ReviewRow
                      label={t('swift.purposeLabel')}
                      value={swiftPurposeOfFunds
                        .map((v) =>
                          v === 'intra_group_transfer'
                            ? t('swift.purposeIntraGroup')
                            : v === 'invoice_for_goods_and_services'
                            ? t('swift.purposeInvoice')
                            : v,
                        )
                        .join(', ')}
                    />
                  ) : null}
                  {swiftBusinessDescription ? (
                    <ReviewRow
                      label={t('swift.businessDescription')}
                      value={swiftBusinessDescription}
                    />
                  ) : null}
                </FormSection>
              ) : null}

              {error ? (
                <p className="text-2 text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </BankingDialogBody>

        <DialogFooter className={BANKING_DIALOG_FOOTER_CLASS}>
          <>
            {(step === 'form' || step === 'compliance') &&
            Object.keys(fieldErrors).length > 0 ? (
              <p
                className="w-full text-center text-1 text-destructive"
                role="alert"
              >
                {t('formHasErrors')}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            {step === 'currency' ? (
              <Button
                type="button"
                colorVariant="accent"
                disabled={isSubmitting}
                onClick={handleContinue}
              >
                {t('continue')}
              </Button>
            ) : step === 'form' ? (
              <Button
                type="button"
                colorVariant="accent"
                disabled={isSubmitting}
                onClick={() => handleFormContinue()}
              >
                {t('continue')}
              </Button>
            ) : step === 'compliance' ? (
              <Button
                type="button"
                colorVariant="accent"
                disabled={isSubmitting}
                onClick={handleComplianceContinue}
              >
                {t('continue')}
              </Button>
            ) : (
              <Button
                type="button"
                colorVariant="accent"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('submitting')}
                  </>
                ) : (
                  t('confirm')
                )}
              </Button>
            )}
          </>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
