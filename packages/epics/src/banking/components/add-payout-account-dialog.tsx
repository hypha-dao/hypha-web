'use client';

import { FC, FormEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
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
import type { BankPayoutAccountPublic, CreatePayoutAccountInput } from '../hooks/types';
import {
  BANKING_DIALOG_FOOTER_CLASS,
  BANKING_DIALOG_FORM_CONTENT_CLASS,
  BANKING_DIALOG_HEADER_CLASS,
  BankingDialogBody,
} from './banking-dialog-layout';
import { CurrencyFlagBadge } from './currency-flag-badge';
import {
  PAYOUT_CURRENCY_KEYS,
  PayoutCurrencyOptionRow,
  payoutCurrencyToRailKey,
  type PayoutCurrencyKey,
} from './payout-currency-option-row';

const ADD_PAYOUT_FORM_ID = 'add-payout-account-form';
const STREET_MAX_LENGTH = 35;

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
  onSubmit: (input: CreatePayoutAccountInput) => Promise<BankPayoutAccountPublic>;
  onSuccess: (account: BankPayoutAccountPublic) => void;
};

function defaultSourceCurrency(currency: PayoutCurrencyKey): 'usdc' | 'eurc' {
  return currency === 'eur' ? 'eurc' : 'usdc';
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

export const AddPayoutAccountDialog: FC<AddPayoutAccountDialogProps> = ({
  open,
  onOpenChange,
  isSubmitting,
  error,
  defaultAccountOwnerName = '',
  defaultBusinessName = '',
  onSubmit,
  onSuccess,
}) => {
  const t = useTranslations('BankingTab.payouts.addDialog');
  const radioName = useId();

  const [step, setStep] = useState<'currency' | 'form' | 'review'>('currency');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedCurrency, setSelectedCurrency] =
    useState<PayoutCurrencyKey>('usd');
  const [sourceCurrency, setSourceCurrency] = useState<'usdc' | 'eurc'>('usdc');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountOwnerName, setAccountOwnerName] = useState(
    defaultAccountOwnerName,
  );
  const [businessName, setBusinessName] = useState(defaultBusinessName);
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [streetLine1, setStreetLine1] = useState('');
  const [streetLine2, setStreetLine2] = useState('');
  const [city, setCity] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');

  const wasOpenRef = useRef(false);

  const clearRailSpecificFields = () => {
    setRoutingNumber('');
    setAccountNumber('');
    setIban('');
    setBic('');
    setSortCode('');
  };

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!justOpened) {
      return;
    }

    setStep('currency');
    setSelectedCurrency('usd');
    setSourceCurrency('usdc');
    setBankName('');
    setAccountName('');
    setAccountOwnerName(defaultAccountOwnerName);
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
  const showIbanFields =
    selectedCurrency === 'eur' || selectedCurrency === 'swift';
  const showGbpFields = selectedCurrency === 'gbp';
  const isUsAddress = country === 'USA';

  const countryOptions =
    selectedCurrency === 'eur' ? SEPA_COUNTRIES
    : selectedCurrency === 'gbp' ? COUNTRIES.filter((c) => c.alpha3 === 'GBR')
    : selectedCurrency === 'usd' ? COUNTRIES.filter((c) => c.alpha3 === 'USA')
    : COUNTRIES;

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
    if (step === 'form') setStep('currency');
    if (step === 'review') setStep('form');
  };

  // form onSubmit: validates IBAN and advances to review step
  const handleFormContinue = (event: FormEvent) => {
    event.preventDefault();
    const nextFieldErrors: Record<string, string> = {};
    const ibanValue = iban.trim().replace(/\s/g, '');
    if (showIbanFields && ibanValue && !isValidIban(ibanValue)) {
      nextFieldErrors.iban = 'Invalid IBAN — check the number and try again';
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    setStep('review');
  };

  // review step: fires the actual POST
  const handleConfirmSubmit = async () => {
    try {
      const account = await onSubmit({
        railKey,
        sourceCurrency,
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountOwnerName: accountOwnerName.trim(),
        accountOwnerType: 'business',
        businessName: businessName.trim() || accountOwnerName.trim(),
        routingNumber: routingNumber.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        iban: iban.trim().replace(/\s/g, '') || undefined,
        bic: bic.trim().toUpperCase() || undefined,
        sortCode: sortCode.trim() || undefined,
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
              : t('step3Description')}
          </DialogDescription>
        </DialogHeader>

        <BankingDialogBody>
          {step === 'currency' ? (
            <div className="flex flex-col gap-4">
              <p className="text-right text-1 text-muted-foreground">
                {t('stepOf', { current: '1', total: '3' })}
              </p>
              <div className="flex flex-col gap-2">
                <Label>{t('currencyLabel')}</Label>
                <p className="text-1 text-muted-foreground">
                  {t('currencyHint')}
                </p>
                <div className="flex flex-col gap-2">
                  {PAYOUT_CURRENCY_KEYS.map((currency) => (
                    <PayoutCurrencyOptionRow
                      key={currency}
                      currency={currency}
                      selected={selectedCurrency === currency}
                      disabled={isSubmitting}
                      radioName={radioName}
                      onSelect={() => handleCurrencySelect(currency)}
                    />
                  ))}
                </div>
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : step === 'form' ? (
            <form
              id={ADD_PAYOUT_FORM_ID}
              onSubmit={handleFormContinue}
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
                  {t('stepOf', { current: '2', total: '3' })}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="payout-account-name">{t('accountName')}</Label>
                <Input
                  id="payout-account-name"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder={t('accountNamePlaceholder')}
                  required
                  disabled={isSubmitting}
                />
                <p className="text-1 text-muted-foreground">
                  {t('accountNameHint')}
                </p>
              </div>

              <PayoutSelectedCurrencyBadge currency={selectedCurrency} />

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
                  {(['usdc', 'eurc'] as const).map((token) => (
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
                  ))}
                </div>
              </FormSection>

              {/* Bank account details */}
              <FormSection title={t('bankAccountSection')}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payout-bank-name">{t('bankName')}</Label>
                  <Input
                    id="payout-bank-name"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                    placeholder={t('bankNamePlaceholder')}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                {showUsFields ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payout-routing">
                        {t('routingNumber')}
                      </Label>
                      <Input
                        id="payout-routing"
                        value={routingNumber}
                        onChange={(event) =>
                          setRoutingNumber(
                            event.target.value.replace(/\D/g, '').slice(0, 9),
                          )
                        }
                        placeholder={t('routingNumberPlaceholder')}
                        inputMode="numeric"
                        maxLength={9}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payout-account-number">
                        {t('accountNumber')}
                      </Label>
                      <Input
                        id="payout-account-number"
                        value={accountNumber}
                        onChange={(event) =>
                          setAccountNumber(event.target.value)
                        }
                        placeholder={t('accountNumberPlaceholder')}
                        inputMode="numeric"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                ) : null}

                {showGbpFields ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payout-sort-code">{t('sortCode')}</Label>
                      <Input
                        id="payout-sort-code"
                        value={sortCode}
                        onChange={(event) => setSortCode(event.target.value)}
                        placeholder={t('sortCodePlaceholder')}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payout-gbp-account">
                        {t('accountNumber')}
                      </Label>
                      <Input
                        id="payout-gbp-account"
                        value={accountNumber}
                        onChange={(event) =>
                          setAccountNumber(event.target.value)
                        }
                        placeholder={t('accountNumberPlaceholder')}
                        inputMode="numeric"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                ) : null}

                {showIbanFields ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payout-iban">{t('iban')}</Label>
                      <Input
                        id="payout-iban"
                        value={iban}
                        onChange={(event) => {
                          setIban(event.target.value.toUpperCase());
                          if (fieldErrors.iban) {
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next.iban;
                              return next;
                            });
                          }
                        }}
                        placeholder={t('ibanPlaceholder')}
                        required={selectedCurrency === 'eur'}
                        disabled={isSubmitting}
                        aria-invalid={!!fieldErrors.iban}
                        aria-describedby={
                          fieldErrors.iban ? 'payout-iban-error' : undefined
                        }
                        className={cn(
                          fieldErrors.iban &&
                            'border-destructive ring-1 ring-destructive focus-visible:ring-destructive',
                        )}
                      />
                      {fieldErrors.iban ? (
                        <p
                          id="payout-iban-error"
                          className="text-1 text-destructive"
                          role="alert"
                        >
                          {fieldErrors.iban}
                        </p>
                      ) : null}
                    </div>
                    {selectedCurrency === 'swift' ? (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="payout-bic">{t('bic')}</Label>
                        <Input
                          id="payout-bic"
                          value={bic}
                          onChange={(event) =>
                            setBic(event.target.value.toUpperCase())
                          }
                          placeholder={t('bicPlaceholder')}
                          maxLength={11}
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </FormSection>

              {/* Account holder */}
              <FormSection title={t('accountHolderSection')}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payout-owner-name">
                    {t('accountOwnerName')}
                  </Label>
                  <Input
                    id="payout-owner-name"
                    value={accountOwnerName}
                    onChange={(event) =>
                      setAccountOwnerName(event.target.value)
                    }
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payout-business-name">
                    {t('businessName')}
                  </Label>
                  <Input
                    id="payout-business-name"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </FormSection>

              {/* Bank address */}
              <FormSection title={t('addressSection')}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payout-street">{t('street')}</Label>
                  <Input
                    id="payout-street"
                    value={streetLine1}
                    onChange={(event) => setStreetLine1(event.target.value)}
                    placeholder={t('streetPlaceholder')}
                    maxLength={STREET_MAX_LENGTH}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payout-street2">{t('street2')}</Label>
                  <Input
                    id="payout-street2"
                    value={streetLine2}
                    onChange={(event) => setStreetLine2(event.target.value)}
                    placeholder={t('street2Placeholder')}
                    maxLength={STREET_MAX_LENGTH}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payout-city">{t('city')}</Label>
                    <Input
                      id="payout-city"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payout-subdivision">
                      {isUsAddress ? t('subdivisionUs') : t('subdivision')}
                    </Label>
                    <Input
                      id="payout-subdivision"
                      value={subdivision}
                      onChange={(event) => setSubdivision(event.target.value)}
                      placeholder={isUsAddress ? 'CA' : undefined}
                      maxLength={isUsAddress ? 2 : undefined}
                      required={isUsAddress}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payout-postal">{t('postalCode')}</Label>
                    <Input
                      id="payout-postal"
                      value={postalCode}
                      onChange={(event) => setPostalCode(event.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="payout-country">{t('country')}</Label>
                    <select
                      id="payout-country"
                      className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-2 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">{t('countryPlaceholder')}</option>
                      {countryOptions.map((c) => (
                        <option key={c.alpha3} value={c.alpha3}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </FormSection>
            </form>
          ) : (
            // Review step
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
                  {t('stepOf', { current: '3', total: '3' })}
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
                {bic ? (
                  <ReviewRow label={t('bic')} value={bic} />
                ) : null}
              </FormSection>

              <FormSection title={t('accountHolderSection')}>
                {accountOwnerName ? (
                  <ReviewRow label={t('accountOwnerName')} value={accountOwnerName} />
                ) : null}
                {businessName ? (
                  <ReviewRow label={t('businessName')} value={businessName} />
                ) : null}
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
                type="submit"
                form={ADD_PAYOUT_FORM_ID}
                colorVariant="accent"
                disabled={isSubmitting}
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
