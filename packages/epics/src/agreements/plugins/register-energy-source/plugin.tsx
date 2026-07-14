'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Input,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';

export const RegisterEnergySourcePlugin = () => {
  const t = useTranslations('Energy.plugins.registerSource');
  const { control } = useFormContext();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name="energySource.sourceId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('sourceId')}</FormLabel>
            <FormControl>
              <Input
                placeholder={t('sourceIdPlaceholder')}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySource.sourceType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('sourceType')}</FormLabel>
            <FormControl>
              <Input
                placeholder={t('sourceTypePlaceholder')}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySource.basePricePerKwh"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('basePricePerKwh')}</FormLabel>
            <FormControl>
              <Input
                type="number"
                min="0"
                step="0.0001"
                placeholder={t('basePricePlaceholder')}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySource.ownershipToken"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('ownershipToken')}</FormLabel>
            <FormControl>
              <Input
                placeholder={t('ownershipTokenPlaceholder')}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySource.deviceIdsCsv"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>{t('deviceIds')}</FormLabel>
            <FormControl>
              <Input
                placeholder={t('deviceIdsPlaceholder')}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
};
