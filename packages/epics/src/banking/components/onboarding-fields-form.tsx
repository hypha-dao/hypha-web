'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import type { BankOnboardingFieldDescriptor } from '@hypha-platform/core/client';

import { isOnboardingFieldRequired } from '../banking-ui';

export type OnboardingFieldsFormProps = {
  /** Deduped field union for the currently-selected onboarding currencies (D10). */
  fields: readonly BankOnboardingFieldDescriptor[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  idPrefix: string;
};

/**
 * Shared, provider-agnostic renderer for the dynamic onboarding form (D10) — walks whatever
 * `BankOnboardingFieldDescriptor[]` the selected currencies' providers declare. No AUDD/Bridge-
 * specific branching here; conditional requirement (`requiredIf`) is resolved generically from
 * each field's own declared rule against the values collected so far.
 */
export const OnboardingFieldsForm: FC<OnboardingFieldsFormProps> = ({
  fields,
  values,
  onChange,
  disabled = false,
  idPrefix,
}) => {
  const t = useTranslations();

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const inputId = `${idPrefix}-${field.key}`;
        const required = isOnboardingFieldRequired(field, values);
        const value = values[field.key] ?? '';

        return (
          <div key={field.key} className="flex flex-col gap-2">
            <Label htmlFor={inputId} className="text-foreground">
              {t(field.i18nLabelKey as Parameters<typeof t>[0])}
            </Label>
            {field.kind === 'select' ? (
              <Select
                value={value}
                onValueChange={(next) => onChange(field.key, next)}
                disabled={disabled}
              >
                <SelectTrigger id={inputId} aria-required={required}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.i18nLabelKey as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={inputId}
                className="text-foreground"
                type={field.kind === 'email' ? 'email' : 'text'}
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                required={required}
                maxLength={1024}
                disabled={disabled}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
