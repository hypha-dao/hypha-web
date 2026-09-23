'use client';

import { FC, FormEvent, useEffect, useRef, useState } from 'react';
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
import { cn } from '@hypha-platform/ui-utils';
import { isBypassEligible } from '@hypha-platform/core/client';

import type { BankOnboardingCurrencyCode } from '../bank-currency-display';
import {
  areOnboardingFieldsComplete,
  getDynamicOnboardingFields,
  ownerText,
  type BankingOwnerContext,
} from '../banking-ui';
import type { BankingInitialSetupProps } from './banking-initial-setup';
import {
  BANKING_DIALOG_FOOTER_CLASS,
  BANKING_DIALOG_FORM_CONTENT_CLASS,
  BANKING_DIALOG_HEADER_CLASS,
  BankingDialogBody,
} from './banking-dialog-layout';
import { OnboardingFieldsForm } from './onboarding-fields-form';

type ProviderOnboardingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The currency being requested. The provider it resolves to decides which extra fields are
   * asked, so the dialog stays provider-agnostic — no currency picker, one currency per request
   * (onboarding is one provider per call, D2/D3).
   */
  currency: BankOnboardingCurrencyCode | null;
  initialLegalName: string;
  initialContactEmail: string;
  /** Whether this is for a space or an individual member's profile. Defaults to 'space'. */
  ownerContext?: BankingOwnerContext;
  isSubmitting: boolean;
  error: string | null;
  /** Same handler as the first-time setup form; a rejection keeps the dialog open for a retry. */
  onSubmit: BankingInitialSetupProps['onSubmit'];
};

/**
 * Onboards an owner that already has one provider with another provider's currency (e.g. AUD for
 * a space that's already set up with Bridge). Asks for the same details as the first-time setup
 * form, restricted to the one currency that was requested.
 */
export const ProviderOnboardingDialog: FC<ProviderOnboardingDialogProps> = ({
  open,
  onOpenChange,
  currency,
  initialLegalName,
  initialContactEmail,
  ownerContext = 'space',
  isSubmitting,
  error,
  onSubmit,
}) => {
  const t = useTranslations('BankingTab.providerOnboarding');
  const tSetup = useTranslations('BankingTab.initialSetup');
  const tOpen = useTranslations('BankingTab.openAccount');
  const tCurrencies = useTranslations('BankingTab.currencies');

  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const wasOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) {
      return;
    }
    setLegalName(initialLegalName.trim());
    setContactEmail(initialContactEmail.trim());
    setFieldValues({});
  }, [open, initialLegalName, initialContactEmail]);

  const dynamicFields = currency ? getDynamicOnboardingFields([currency]) : [];

  const canSubmit =
    currency != null &&
    Boolean(legalName.trim()) &&
    Boolean(contactEmail.trim()) &&
    areOnboardingFieldsComplete(dynamicFields, fieldValues);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!currency || !canSubmit) {
      return;
    }
    try {
      await onSubmit({
        legalName: legalName.trim(),
        contactEmail: contactEmail.trim(),
        currencies: [currency],
        onboardingFields: fieldValues,
      });
    } catch {
      // The failure is shown through the `error` prop; the dialog stays open so it can be retried.
    }
  };

  const formId = 'provider-onboarding-form';

  return (
    <Dialog open={open && currency != null} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(BANKING_DIALOG_FORM_CONTENT_CLASS, 'max-w-lg')}
      >
        <DialogHeader className={cn(BANKING_DIALOG_HEADER_CLASS, 'pr-10')}>
          <DialogTitle>
            {currency
              ? t('title', { currency: tCurrencies(`${currency}.code`) })
              : null}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <BankingDialogBody>
          <form
            id={formId}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="provider-onboarding-legal-name"
                className="text-foreground"
              >
                {ownerText(tSetup, ownerContext, 'legalName')}
              </Label>
              <Input
                id="provider-onboarding-legal-name"
                className="text-foreground"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
                maxLength={1024}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="provider-onboarding-email"
                className="text-foreground"
              >
                {tSetup('contactEmail')}
              </Label>
              <Input
                id="provider-onboarding-email"
                className="text-foreground"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
              <p className="text-1 text-muted-foreground">
                {isBypassEligible(initialContactEmail, contactEmail)
                  ? tSetup('bypassEligibleHint')
                  : tSetup('confirmationRequiredHint')}
              </p>
            </div>

            {dynamicFields.length > 0 ? (
              <section
                className="flex flex-col gap-4"
                aria-labelledby="provider-onboarding-fields-title"
              >
                <div className="flex flex-col gap-1">
                  <h3
                    id="provider-onboarding-fields-title"
                    className="text-3 font-semibold tracking-tight text-foreground"
                  >
                    {tSetup('providerFieldsTitle')}
                  </h3>
                  <p className="text-2 text-muted-foreground">
                    {tSetup('providerFieldsHint')}
                  </p>
                </div>
                <OnboardingFieldsForm
                  fields={dynamicFields}
                  values={fieldValues}
                  onChange={(key, value) =>
                    setFieldValues((current) => ({ ...current, [key]: value }))
                  }
                  disabled={isSubmitting}
                  idPrefix="provider-onboarding"
                  entityType={
                    ownerContext === 'person' ? 'individual' : 'business'
                  }
                />
              </section>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </BankingDialogBody>

        <DialogFooter className={BANKING_DIALOG_FOOTER_CLASS}>
          <Button
            type="submit"
            form={formId}
            colorVariant="accent"
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tOpen('submitting')}
              </>
            ) : (
              tSetup('submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
