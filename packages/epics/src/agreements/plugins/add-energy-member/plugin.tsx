'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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

export const AddEnergyMemberPlugin = ({
  members = [],
  spaces = [],
}: AddEnergyMemberPluginProps) => {
  const t = useTranslations('Energy.plugins.addMember');
  const { control } = useFormContext();

  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        name="energyMember.memberAddress"
        members={members}
        spaces={spaces}
        defaultRecipientType="member"
        label={t('member')}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={control}
          name="energyMember.metadataHash"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('metadataHash')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('metadataHashPlaceholder')}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="energyMember.deviceIdsCsv"
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
    </div>
  );
};
