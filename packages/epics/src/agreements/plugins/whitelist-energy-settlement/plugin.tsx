'use client';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  Input,
  Switch,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';

export const WhitelistEnergySettlementPlugin = () => {
  const t = useTranslations('Energy.plugins.whitelistSettlement');
  const { control } = useFormContext();

  return (
    <div className="flex flex-col gap-4">
      <FormField
        control={control}
        name="energySettlementWhitelist.account"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('settlementAddress')}</FormLabel>
            <FormDescription>
              {t('settlementAddressDescription')}
            </FormDescription>
            <FormControl>
              <Input
                placeholder={t('settlementAddressPlaceholder')}
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySettlementWhitelist.whitelisted"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-neutral-5 p-4">
            <div className="space-y-0.5">
              <FormLabel>{t('whitelisted')}</FormLabel>
              <FormDescription>{t('whitelistedDescription')}</FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value ?? true}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
};
