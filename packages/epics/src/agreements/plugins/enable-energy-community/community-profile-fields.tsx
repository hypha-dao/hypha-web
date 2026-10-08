'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useFormContext, useWatch } from 'react-hook-form';
import clsx from 'clsx';
import { Battery, Coins, Zap } from 'lucide-react';
import {
  ENERGY_COMMUNITY_COUNTRIES,
  ENERGY_COMMUNITY_TIME_ZONES,
  EMS_OBJECTIVES,
  emsObjectiveFromBasePurpose,
  timeZoneForCountry,
  type EmsObjective,
} from '@hypha-platform/core/client';
import {
  Card,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { SpaceLocationPicker } from '../../../spaces/components/space-location-picker';

const EMS_OBJECTIVE_CONTENT: Record<
  EmsObjective,
  { labelKey: string; descriptionKey: string; icon: React.ReactNode }
> = {
  LowestPrice: {
    labelKey: 'emsLowestPrice',
    descriptionKey: 'emsLowestPriceDescription',
    icon: <Coins className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />,
  },
  MaximumSelfConsumption: {
    labelKey: 'emsSelfConsumption',
    descriptionKey: 'emsSelfConsumptionDescription',
    icon: <Zap className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />,
  },
  BatteryFirst: {
    labelKey: 'emsBatteryFirst',
    descriptionKey: 'emsBatteryFirstDescription',
    icon: (
      <Battery className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
    ),
  },
};

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
  const emsTouched = React.useRef(false);
  const purpose1 = useWatch({ control, name: 'energyOptimization.purpose1' });
  const address = useWatch({ control, name: 'energyCommunityProfile.address' });
  const latitude = useWatch({
    control,
    name: 'energyCommunityProfile.latitude',
  });
  const longitude = useWatch({
    control,
    name: 'energyCommunityProfile.longitude',
  });

  React.useEffect(() => {
    if (emsTouched.current) return;
    const mapped = emsObjectiveFromBasePurpose(
      typeof purpose1 === 'string' ? purpose1 : null,
    );
    if (!mapped) return;
    setValue('energyCommunityProfile.emsObjective', mapped, {
      shouldValidate: true,
      shouldDirty: false,
    });
  }, [purpose1, setValue]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1">
          <div className="text-1 font-medium">{t('locationTitle')}</div>
          <p className="text-2 text-secondary-foreground">
            {t('locationDescription')}
          </p>
        </div>
        <SpaceLocationPicker
          value={{
            latitude: typeof latitude === 'number' ? latitude : null,
            longitude: typeof longitude === 'number' ? longitude : null,
            locationLabel: typeof address === 'string' ? address : null,
            locationSource:
              typeof latitude === 'number' && typeof longitude === 'number'
                ? 'manual'
                : null,
          }}
          onChange={(next) => {
            setValue(
              'energyCommunityProfile.address',
              next.locationLabel ?? '',
              { shouldValidate: true, shouldDirty: true },
            );
            setValue('energyCommunityProfile.latitude', next.latitude, {
              shouldValidate: true,
              shouldDirty: true,
            });
            setValue('energyCommunityProfile.longitude', next.longitude, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />
        <FormField
          control={control}
          name="energyCommunityProfile.address"
          render={() => (
            <FormItem>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField
            control={control}
            name="energyCommunityProfile.city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('city')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('cityPlaceholder')}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="energyCommunityProfile.region"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('region')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('regionPlaceholder')}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="energyCommunityProfile.postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('postalCode')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('postalCodePlaceholder')}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="energyCommunityProfile.countryIso"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('country')}</FormLabel>
                <FormControl>
                  <Select
                    value={field.value ? field.value : 'UNSET'}
                    onValueChange={(value) => {
                      const iso = value === 'UNSET' ? '' : value;
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
                      <SelectItem value="UNSET">{t('countryUnset')}</SelectItem>
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
          <FormField
            control={control}
            name="energyCommunityProfile.timeZone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('timeZone')}</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectTimeZone')} />
                    </SelectTrigger>
                    <SelectContent>
                      {ENERGY_COMMUNITY_TIME_ZONES.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone}
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
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1">
          <div className="text-1 font-medium">{t('emsObjectiveTitle')}</div>
          <p className="text-2 text-secondary-foreground">
            {t('emsObjectiveDescription')}
          </p>
        </div>
        <FormField
          control={control}
          name="energyCommunityProfile.emsObjective"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex flex-col gap-3">
                  {EMS_OBJECTIVES.map((objective) => {
                    const content = EMS_OBJECTIVE_CONTENT[objective];
                    const selected = field.value === objective;
                    return (
                      <Card
                        key={objective}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected}
                        className={clsx(
                          'flex cursor-pointer items-center space-x-4 border-2 p-5',
                          {
                            'border-accent-9': selected,
                            'hover:border-accent-5': !selected,
                          },
                        )}
                        onClick={() => {
                          emsTouched.current = true;
                          field.onChange(objective);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') {
                            return;
                          }
                          event.preventDefault();
                          emsTouched.current = true;
                          field.onChange(objective);
                        }}
                      >
                        <div>{content.icon}</div>
                        <div className="flex flex-col">
                          <span className="text-3 font-medium">
                            {t(content.labelKey)}
                          </span>
                          <span className="text-1 text-neutral-11">
                            {t(content.descriptionKey)}
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
