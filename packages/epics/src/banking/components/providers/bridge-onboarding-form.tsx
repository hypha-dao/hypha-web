'use client';

import { FC, FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, Input, Label } from '@hypha-platform/ui';

import type { ProviderOnboardingFormProps } from './types';
import { BRIDGE_ENDORSEMENT_OPTIONS } from './bridge-endorsement-options';

export const BridgeOnboardingForm: FC<ProviderOnboardingFormProps> = ({
  formId,
  onSubmit,
  isSubmitting,
  initialValues,
}) => {
  const t = useTranslations('BankingTab.onboardingDialog');
  const tEndorsements = useTranslations('BankingTab.endorsements');

  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [endorsements, setEndorsements] = useState<string[]>([]);
  const [endorsementError, setEndorsementError] = useState<string | null>(null);

  useEffect(() => {
    setLegalName(initialValues?.legalName?.trim() ?? '');
    setContactEmail(initialValues?.contactEmail?.trim() ?? '');
    setEndorsements(initialValues?.endorsements ?? []);
    setEndorsementError(null);
  }, [
    initialValues?.legalName,
    initialValues?.contactEmail,
    initialValues?.endorsements,
  ]);

  const toggleEndorsement = (value: string, checked: boolean) => {
    setEndorsementError(null);
    setEndorsements((current) =>
      checked ? [...current, value] : current.filter((item) => item !== value),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = legalName.trim();
    const trimmedEmail = contactEmail.trim();

    if (!trimmedName || !trimmedEmail) {
      return;
    }

    if (endorsements.length === 0) {
      setEndorsementError(t('endorsementsRequired'));
      return;
    }

    await onSubmit({
      legalName: trimmedName,
      contactEmail: trimmedEmail,
      endorsements,
    });
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
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
          {BRIDGE_ENDORSEMENT_OPTIONS.map((option) => {
            const inputId = `bank-endorsement-${option.value}`;
            const checked = endorsements.includes(option.value);
            return (
              <label
                key={option.value}
                htmlFor={inputId}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  disabled={isSubmitting}
                  onCheckedChange={(value) =>
                    toggleEndorsement(option.value, value === true)
                  }
                />
                <span>{tEndorsements(option.labelKey)}</span>
              </label>
            );
          })}
        </div>
        {endorsementError ? (
          <p className="text-sm text-destructive" role="alert">
            {endorsementError}
          </p>
        ) : null}
      </fieldset>
    </form>
  );
};
