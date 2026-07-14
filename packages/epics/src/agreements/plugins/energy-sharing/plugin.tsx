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

export const EnergySharingPlugin = () => {
  const t = useTranslations('Energy.plugins.energySharing');
  const { control } = useFormContext();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name="energySharing.settlementWindow"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('settlementWindow')}</FormLabel>
            <FormControl>
              <Input
                placeholder={t('settlementWindowPlaceholder')}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySharing.creditPolicy"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('creditPolicy')}</FormLabel>
            <FormControl>
              <Input
                placeholder={t('creditPolicyPlaceholder')}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySharing.debtPolicy"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('debtPolicy')}</FormLabel>
            <FormControl>
              <Input
                placeholder={t('debtPolicyPlaceholder')}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySharing.effectiveFrom"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('effectiveFrom')}</FormLabel>
            <FormControl>
              <Input
                type="date"
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
