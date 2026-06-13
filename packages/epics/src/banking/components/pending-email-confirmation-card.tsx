'use client';

import { FC, FormEvent, useEffect, useState } from 'react';
import { HelpCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge, Button, Checkbox, Input, Label } from '@hypha-platform/ui';

import type { BankCurrencyCode } from '../bank-currency-display';
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
> = ({ pending, initialLegalName, isSubmitting, error, onSubmit }) => {
  const t = useTranslations('BankingTab.pendingEmailConfirmation');
  const tOpen = useTranslations('BankingTab.openAccount');

  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [resendEnabled, setResendEnabled] = useState(false);

  useEffect(() => {
    setLegalName(initialLegalName.trim());
    setContactEmail('');
    setResendEnabled(false);
  }, [initialLegalName]);

  const requestedRails = (pending.requestedRails ?? []) as BankCurrencyCode[];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!resendEnabled || !legalName.trim() || !contactEmail.trim()) {
      return;
    }
    await onSubmit({
      legalName: legalName.trim(),
      contactEmail: contactEmail.trim(),
      requestedRails,
    });
  };

  const canSubmit =
    resendEnabled && Boolean(legalName.trim()) && Boolean(contactEmail.trim());

  return (
    <div className="rounded-lg border border-border/80 bg-background-2/30 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-2 font-medium text-foreground">{t('title')}</p>
        <Badge
          variant="outline"
          colorVariant="neutral"
          className="pointer-events-none cursor-default text-1 shadow-none transition-none hover:border-neutral-8 hover:bg-transparent hover:text-neutral-11 hover:ring-transparent"
        >
          {t('statusPending')}
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="mt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-[3] flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pending-bank-legal-name">
                {tOpen('legalName')}
              </Label>
              <Input
                id="pending-bank-legal-name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
                maxLength={1024}
                disabled={isSubmitting || !resendEnabled}
              />
            </div>
            <div className="flex flex-col gap-1.5">
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
          </div>

          <div className="flex flex-[2] flex-col gap-4">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox
                checked={resendEnabled}
                disabled={isSubmitting}
                onCheckedChange={(value) => setResendEnabled(value === true)}
              />
              <span className="flex items-center gap-1">
                {t('resendCheckbox')}
                <span
                  title={t('resendHelper')}
                  className="text-muted-foreground"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </span>
              </span>
            </label>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="mt-auto"
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
