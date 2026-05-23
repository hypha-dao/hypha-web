'use client';

import { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@hypha-platform/ui';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import { BANKING_READONLY_INPUT_CLASS } from '../banking-ui';
import { CurrencyFlagBadge } from './currency-flag-badge';

type AddBankCurrencyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  legalName: string;
  contactEmail: string;
  availableCurrencies: BankCurrencyCode[];
  submittingCurrency: BankCurrencyCode | null;
  error: string | null;
  onAddCurrency: (currency: BankCurrencyCode) => Promise<void>;
};

export const AddBankCurrencyDialog: FC<AddBankCurrencyDialogProps> = ({
  open,
  onOpenChange,
  legalName,
  contactEmail,
  availableCurrencies,
  submittingCurrency,
  error,
  onAddCurrency,
}) => {
  const t = useTranslations('BankingTab.openAccount');
  const tCurrencies = useTranslations('BankingTab.currencies');
  const tOp = useTranslations('BankingTab.operationStatus');
  const isSubmitting = submittingCurrency != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('titleAddCurrency')}</DialogTitle>
          <DialogDescription>
            {t('descriptionAddCurrencySingle')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-currency-legal-name">{t('legalName')}</Label>
            <Input
              id="add-currency-legal-name"
              value={legalName}
              maxLength={1024}
              readOnly
              tabIndex={-1}
              disabled={isSubmitting}
              className={BANKING_READONLY_INPUT_CLASS}
              onFocus={(event) => event.currentTarget.blur()}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-currency-email">{t('contactEmail')}</Label>
            <Input
              id="add-currency-email"
              type="email"
              value={contactEmail}
              readOnly
              tabIndex={-1}
              disabled={isSubmitting}
              className={BANKING_READONLY_INPUT_CLASS}
              onFocus={(event) => event.currentTarget.blur()}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
              {t('currenciesLabel')}
            </legend>
            <p className="text-sm text-muted-foreground">
              {t('currenciesHintSingle')}
            </p>
            {availableCurrencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('noCurrenciesAvailable')}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {availableCurrencies.map((currency) => {
                  const meta = getBankCurrencyMeta(currency);
                  const isAdding = submittingCurrency === currency;

                  return (
                    <Button
                      key={currency}
                      type="button"
                      colorVariant="accent"
                      variant="outline"
                      className="h-auto justify-start gap-3 px-3 py-3"
                      disabled={isSubmitting}
                      onClick={() => void onAddCurrency(currency)}
                    >
                      <CurrencyFlagBadge currency={currency} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                        <span className="text-2 font-semibold">
                          {meta
                            ? tCurrencies(`${meta.nameKey}.code`)
                            : currency.toUpperCase()}
                        </span>
                        <span className="text-1 font-normal text-muted-foreground">
                          {meta
                            ? tCurrencies(`${meta.nameKey}.payoutMethod`)
                            : currency.toUpperCase()}
                        </span>
                      </span>
                      {isAdding ? (
                        <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin" />
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            )}
          </fieldset>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {tOp('activateFailed')}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
