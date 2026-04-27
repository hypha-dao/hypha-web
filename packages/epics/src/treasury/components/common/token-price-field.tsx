'use client';

import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  Input,
  FormMessage,
  RequirementMark,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

/**
 * Decimal as `type="text"` + draft string while editing (not `type="number"`).
 * Avoids browser number-input quirks (can't fully clear, leading 0, spinner)
 * and matches robust currency-style inputs; RHF still stores `number | undefined`
 * for Zod + orchestrator.
 */
export const TokenPriceField = () => {
  const { control, formState, setValue } = useFormContext();
  const tAgreementFlow = useTranslations('AgreementFlow');
  const enableTokenPrice = useWatch({
    control,
    name: 'enableTokenPrice',
    defaultValue: false,
  });

  return (
    <FormField
      control={control}
      name="tokenPrice"
      render={({ field }) => {
        const [draft, setDraft] = React.useState<string | null>(null);

        const display =
          draft !== null
            ? draft
            : field.value === undefined || field.value === null
              ? ''
              : String(field.value);

        const commitFromText = (raw: string) => {
          const t = raw.trim().replace(',', '.');
          if (t === '' || t === '.') {
            setValue('tokenPrice', undefined, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
            return;
          }
          const n = parseFloat(t);
          if (!Number.isNaN(n)) {
            setValue('tokenPrice', n, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
          }
        };

        return (
          <FormItem>
            <div className="flex w-full justify-between">
              <div className="flex gap-1 w-full">
                <span className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
                  {tAgreementFlow(
                    'plugins.issueNewToken.value.tokenPriceLabel',
                  )}
                </span>
                {enableTokenPrice && <RequirementMark className="text-2" />}
              </div>
              <FormControl>
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={tAgreementFlow(
                    'plugins.issueNewToken.value.tokenPricePlaceholder',
                  )}
                  name={field.name}
                  ref={field.ref}
                  value={display}
                  onFocus={() => {
                    setDraft(
                      field.value === undefined || field.value === null
                        ? ''
                        : String(field.value),
                    );
                  }}
                  onBlur={() => {
                    if (draft !== null) {
                      commitFromText(draft);
                    }
                    setDraft(null);
                    field.onBlur();
                  }}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDraft(next);
                    const allowChars = /^[\d.,]*$/;
                    if (!allowChars.test(next)) {
                      return;
                    }
                    const t = next.trim().replace(',', '.');
                    if (t === '') {
                      setValue('tokenPrice', undefined, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                      return;
                    }
                    if (t === '.' || /\.$/.test(t)) {
                      return;
                    }
                    const n = parseFloat(t);
                    if (!Number.isNaN(n)) {
                      setValue('tokenPrice', n, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                />
              </FormControl>
            </div>
            {formState.isSubmitted && <FormMessage />}
          </FormItem>
        );
      }}
    />
  );
};
