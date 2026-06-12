'use client';

import { FC, FormEvent, useEffect, useId, useRef, useState } from 'react';
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

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import type { CreatePayoutAccountInput } from '../hooks/types';
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

type AddPayoutAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  error: string | null;
  defaultAccountOwnerName?: string;
  defaultBusinessName?: string;
  onSubmit: (input: CreatePayoutAccountInput) => Promise<void>;
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

export const AddPayoutAccountDialog: FC<AddPayoutAccountDialogProps> = ({
  open,
  onOpenChange,
  isSubmitting,
  error,
  defaultAccountOwnerName = '',
  defaultBusinessName = '',
  onSubmit,
}) => {
  const t = useTranslations('BankingTab.payouts.addDialog');
  const radioName = useId();

  const [step, setStep] = useState<'currency' | 'form'>('currency');
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
    setCity('');
    setSubdivision('');
    setPostalCode('');
    setCountry('');
  }, [open, defaultAccountOwnerName, defaultBusinessName]);

  const railKey = payoutCurrencyToRailKey(selectedCurrency);
  const showUsFields = selectedCurrency === 'usd';
  const showIbanFields =
    selectedCurrency === 'eur' || selectedCurrency === 'swift';
  const showGbpFields = selectedCurrency === 'gbp';

  const handleCurrencySelect = (currency: PayoutCurrencyKey) => {
    if (currency !== selectedCurrency) {
      clearRailSpecificFields();
      setSourceCurrency(defaultSourceCurrency(currency));
    }
    setSelectedCurrency(currency);
  };

  const handleContinue = () => {
    setStep('form');
  };

  const handleBack = () => {
    setStep('currency');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    await onSubmit({
      railKey,
      sourceCurrency,
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountOwnerName: accountOwnerName.trim(),
      accountOwnerType: 'business',
      businessName: businessName.trim() || accountOwnerName.trim(),
      routingNumber: routingNumber.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      iban: iban.trim() || undefined,
      bic: bic.trim() || undefined,
      sortCode: sortCode.trim() || undefined,
      address: {
        street_line_1: streetLine1.trim(),
        city: city.trim(),
        subdivision: subdivision.trim() || undefined,
        postal_code: postalCode.trim(),
        country: country.trim(),
      },
    });
  };

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
              : t('step2Description')}
          </DialogDescription>
        </DialogHeader>

        <BankingDialogBody>
          {step === 'currency' ? (
            <div className="flex flex-col gap-4">
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
          ) : (
            <form
              id={ADD_PAYOUT_FORM_ID}
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
            >
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

              <PayoutSelectedCurrencyBadge currency={selectedCurrency} />

              {selectedCurrency === 'swift' ? (
                <p className="text-1 text-muted-foreground">
                  {t('swiftFeeCaveat')}
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                <Label htmlFor="payout-source-currency">
                  {t('sourceCurrencyLabel')}
                </Label>
                <select
                  id="payout-source-currency"
                  className="rounded-md border border-border bg-background px-3 py-2 text-2"
                  value={sourceCurrency}
                  onChange={(event) =>
                    setSourceCurrency(event.target.value as 'usdc' | 'eurc')
                  }
                  disabled={isSubmitting}
                >
                  <option value="usdc">USDC</option>
                  <option value="eurc">EURC</option>
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="payout-bank-name">{t('bankName')}</Label>
                  <Input
                    id="payout-bank-name"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="payout-account-name">
                    {t('accountName')}
                  </Label>
                  <Input
                    id="payout-account-name"
                    value={accountName}
                    onChange={(event) => setAccountName(event.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
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
                <div className="flex flex-col gap-2 sm:col-span-2">
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

                {showUsFields ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payout-routing">
                        {t('routingNumber')}
                      </Label>
                      <Input
                        id="payout-routing"
                        value={routingNumber}
                        onChange={(event) =>
                          setRoutingNumber(event.target.value)
                        }
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
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </>
                ) : null}

                {showGbpFields ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payout-sort-code">{t('sortCode')}</Label>
                      <Input
                        id="payout-sort-code"
                        value={sortCode}
                        onChange={(event) => setSortCode(event.target.value)}
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
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </>
                ) : null}

                {showIbanFields ? (
                  <>
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <Label htmlFor="payout-iban">{t('iban')}</Label>
                      <Input
                        id="payout-iban"
                        value={iban}
                        onChange={(event) => setIban(event.target.value)}
                        required={selectedCurrency === 'eur'}
                        disabled={isSubmitting}
                      />
                    </div>
                    {selectedCurrency === 'swift' ? (
                      <div className="flex flex-col gap-2 sm:col-span-2">
                        <Label htmlFor="payout-bic">{t('bic')}</Label>
                        <Input
                          id="payout-bic"
                          value={bic}
                          onChange={(event) => setBic(event.target.value)}
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="payout-street">{t('street')}</Label>
                  <Input
                    id="payout-street"
                    value={streetLine1}
                    onChange={(event) => setStreetLine1(event.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
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
                  <Label htmlFor="payout-subdivision">{t('subdivision')}</Label>
                  <Input
                    id="payout-subdivision"
                    value={subdivision}
                    onChange={(event) => setSubdivision(event.target.value)}
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
                  <Input
                    id="payout-country"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {error ? (
                <p className="text-2 text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
          )}
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
          {step === 'currency' ? (
            <Button
              type="button"
              colorVariant="accent"
              disabled={isSubmitting}
              onClick={handleContinue}
            >
              {t('continue')}
            </Button>
          ) : (
            <Button
              type="submit"
              form={ADD_PAYOUT_FORM_ID}
              colorVariant="accent"
              disabled={isSubmitting}
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
