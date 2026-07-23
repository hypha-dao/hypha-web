'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@hypha-platform/ui';
import type { Person, Space } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { RecipientField } from '../components/common/recipient-field';

type AddEnergyMemberPluginProps = {
  members?: Person[];
  spaces?: Space[];
};

/**
 * Add Energy Member fields, mirroring the "Members" section of the
 * Enable Energy Community form: pick a space member and their meter count.
 */
export const AddEnergyMemberPlugin = ({
  members = [],
  spaces = [],
}: AddEnergyMemberPluginProps) => {
  const t = useTranslations('Energy.plugins.enableCommunity');
  const tMember = useTranslations('Energy.plugins.addMember');
  const { control } = useFormContext();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1">
        <div className="text-1 font-medium">{tMember('member')}</div>
        <p className="text-2 text-secondary-foreground">
          {tMember('sectionDescription')}
        </p>
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <RecipientField
          name="energyMember.recipient"
          members={members}
          spaces={spaces}
          defaultRecipientType="member"
        />
        <FormField
          control={control}
          name="energyMember.meterCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-2 text-neutral-11">
                {t('numberOfMeters')}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  className="w-28"
                  placeholder={t('meterPlaceholder')}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
