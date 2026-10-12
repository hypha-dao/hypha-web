'use client';

import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import {
  ENERGY_COMMUNITY_COUNTRIES,
  timeZoneForCountry,
} from '@hypha-platform/core/client';
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

const COUNTRY_LABEL_KEY: Record<
  (typeof ENERGY_COMMUNITY_COUNTRIES)[number]['iso'],
  string
> = {
  AT: 'countryAT',
  FR: 'countryFR',
  PT: 'countryPT',
  ES: 'countryES',
  NL: 'countryNL',
  NO: 'countryNO',
};

export const EnergyCommunityProfileFields = () => {
  const translate = useTranslations('Energy.plugins.enableCommunity');
  const t = translate as (key: string) => string;
  const { control, setValue } = useFormContext();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <FormField
        control={control}
        name="energyCommunityProfile.countryIso"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('country')}</FormLabel>
            <FormControl>
              <Select
                value={field.value ? field.value : undefined}
                onValueChange={(iso) => {
                  field.onChange(iso);
                  const zone = timeZoneForCountry(iso);
                  if (zone) {
                    setValue('energyCommunityProfile.timeZone', zone, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectCountry')} />
                </SelectTrigger>
                <SelectContent>
                  {ENERGY_COMMUNITY_COUNTRIES.map((country) => (
                    <SelectItem key={country.iso} value={country.iso}>
                      {t(COUNTRY_LABEL_KEY[country.iso])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
