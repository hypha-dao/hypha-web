'use client';

import { FC, FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge, Button, Checkbox, Input, Label } from '@hypha-platform/ui';

import {
  BANK_CURRENCY_METAS,
  type BankCurrencyCode,
} from '../bank-currency-display';
import type { BankCustomerPublicStatus } from '../hooks/types';

type PendingEmailConfirmationCardProps = {
  pending: NonNullable<BankCustomerPublicStatus['pendingEmailConfirmation']>;
  initialLegalName: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: {
    legalName: string;
    contactEmail: string;
    requestedRails: BankCurrencyCode[];
  }) => Promise<void>;
};

export const PendingEmailConfirmationCard: FC<
  PendingEmailConfirmationCardProps
> = ({
  pending,
  initialLegalName,
  isSubmitting,
  error,
  onSubmit,
}) => {
  const t = useTranslations('BankingTab.pendingEmailConfirmation');
  const tCurrencies = useTranslations('BankingTab.currencies');
  const tOpen = useTranslations('BankingTab.openAccount');

  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [requestedRails, setRequestedRails] = useState<BankCurrencyCode[]>([]);
  const [resendEnabled, setResendEnabled] = useState(false);

  useEffect(() => {
    setLegalName(initialLegalName.trim());
    setContactEmail('');
    setRequestedRails(
      (pending.requestedRails ?? []) as BankCurrencyCode[],
    );
    setResendEnabled(false);
  }, [initialLegalName, pending.requestedRails]);

  const toggleRail = (currency: BankCurrencyCode, checked: boolean) => {
    setRequestedRails((current) =>
      checked ? [...current, currency] : current.filter((c) => c !== currency),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !resendEnabled ||
      !legalName.trim() ||
      !contactEmail.trim() ||
      requestedRails.length === 0
    ) {
      return;
    }

    await onSubmit({
      legalName: legalName.trim(),
      contactEmail: contactEmail.trim(),
      requestedRails,
    });
  };

  const canSubmit =
    resendEnabled &&
    Boolean(legalName.trim()) &&
    Boolean(contactEmail.trim()) &&
    requestedRails.length > 0;

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-background-2/50 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-3 font-semibold text-foreground">{t('title')}</h2>
          <Badge variant="secondary">{t('statusPending')}</Badge>
        </div>
        <p className="text-2 text-muted-foreground">{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pending-bank-legal-name">{tOpen('legalName')}</Label>
          <Input
            id="pending-bank-legal-name"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            required
            maxLength={1024}
            disabled={isSubmitting || !resendEnabled}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="pending-bank-contact-email">
            {t('contactEmailLabel')}
          </Label>
          <Input
            id="pending-bank-contact-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
            disabled={isSubmitting || !resendEnabled}
          />
        </div>

        <fieldset className="flex flex-col gap-2" disabled={!resendEnabled}>
          <legend className="text-sm font-medium">{t('railsLabel')}</legend>
          <div className="flex flex-col gap-2">
            {BANK_CURRENCY_METAS.map((meta) => {
              const inputId = `pending-bank-rail-${meta.currency}`;
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
                    disabled={isSubmitting || !resendEnabled}
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

        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            checked={resendEnabled}
            disabled={isSubmitting}
            onCheckedChange={(value) => setResendEnabled(value === true)}
          />
          <span>{t('resendCheckbox')}</span>
        </label>
        <p className="text-sm text-muted-foreground">{t('resendHelper')}</p>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting || !canSubmit}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            t('submit')
          )}
        </Button>
      </form>
    </div>
  );
};
