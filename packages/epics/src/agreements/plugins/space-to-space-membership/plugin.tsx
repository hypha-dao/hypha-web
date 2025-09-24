'use client';

import { Person, type Space } from '@hypha-platform/core/client';
import { useFormContext } from 'react-hook-form';
import {
  Separator,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Label,
  RequirementMark,
} from '@hypha-platform/ui';
import { SpaceToSpaceMembershipSelector } from '../components/common/space-to-space-membership-selector';

export interface SpaceToSpaceMembershipPluginProps {
  spaces?: Space[];
  members?: Person[];
}

export const SpaceToSpaceMembershipPlugin = ({
  spaces,
  members,
}: SpaceToSpaceMembershipPluginProps) => {
  const { control, setValue } = useFormContext();

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex gap-1">
        <Label>Space</Label>
        <RequirementMark />
      </div>
      <FormField
        control={control}
        name="space"
        render={({ field: { value, onChange } }) => (
          <FormItem>
            <FormControl>
              <SpaceToSpaceMembershipSelector
                value={value}
                onChange={(space) => {
                  onChange(space?.address);
                }}
                spaceOptions={spaces}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <Separator />
      <div className="flex gap-1">
        <Label>Delegation Rules</Label>
        <RequirementMark />
      </div>
      <FormField
        control={control}
        name="member"
        render={({ field: { value, onChange } }) => (
          <FormItem>
            <FormControl>
              <SpaceToSpaceMembershipSelector
                value={value}
                onChange={(member) => {
                  onChange(member?.address);
                }}
                memberOptions={members}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
