'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { CAPITALS, parseCapitalKey } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

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
            <div className="flex justify-between items-center gap-3">
              <FormLabel className="text-2 text-neutral-11 w-full gap-1">
                {t('formOfCapital')}
              </FormLabel>
              <FormControl>
                <Select
                  value={current ?? undefined}
                  onValueChange={(value) => field.onChange(value)}
                >
                  <SelectTrigger className="w-full max-w-[280px]">
                    <SelectValue placeholder={t('capitalHintOne')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPITALS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(`capitals.${key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
