'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@hypha-platform/ui';
import { parseCapitalKey } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { CapitalChoice } from '../../../spaces/components/capital-choice';

export function TokenCapitalField() {
  const { control } = useFormContext();
  const t = useTranslations('NetworkExchange');

  return (
    <FormField
      control={control}
      name="capital"
      render={({ field }) => {
        const current = parseCapitalKey(field.value);
        return (
          <FormItem>
            <FormLabel className="text-2 text-neutral-11 w-full gap-1">
              {t('formOfCapital')}
            </FormLabel>
            <FormDescription>{t('capitalHintOne')}</FormDescription>
            <CapitalChoice
              mode="one"
              selected={current ? [current] : []}
              onChange={(next) => field.onChange(next[0] ?? '')}
            />
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
