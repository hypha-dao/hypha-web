'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Input,
} from '@hypha-platform/ui';
import type { Person, Space } from '@hypha-platform/core/client';
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
  const { control } = useFormContext();

  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        name="energyMember.memberAddress"
        members={members}
        spaces={spaces}
        defaultRecipientType="member"
        label="Member"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={control}
          name="energyMember.metadataHash"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Metadata Hash</FormLabel>
              <FormControl>
                <Input
                  placeholder="0x... or ipfs hash"
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
              <FormLabel>Device IDs (comma separated)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. 201,202,203"
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
