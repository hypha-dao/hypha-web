'use client';

import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  FormLabel,
  Switch,
} from '@hypha-platform/ui';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';

export const TokenPurchaseToggleSection = () => {
  const t = useTranslations('SpaceTokenPurchase');
  const { control } = useFormContext();
  const activatePurchase =
    useWatch({ control, name: 'activatePurchase' }) ?? false;

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>{t('toggle.sectionTitle')}</FormLabel>
      <span className="text-2 text-neutral-11">{t('toggle.description')}</span>
      <FormField
        control={control}
        name="activatePurchase"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between gap-4">
              <label
                id="activate-purchase-label"
                className="text-2 text-neutral-11"
              >
                {t('toggle.activateLabel')}
              </label>
              <FormControl>
                <Switch
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  aria-labelledby="activate-purchase-label"
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      {!activatePurchase && (
        <span className="text-2 text-neutral-11 italic">
          {t('toggle.disabledHint')}
        </span>
      )}
    </div>
  );
};
