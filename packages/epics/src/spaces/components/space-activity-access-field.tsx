'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';
import {
  TransparencyLevelComponent,
  TransparencyLevel,
  TransparencyOption,
} from './transparency-level';

const activityAccessOptions: TransparencyOption[] = [
  {
    id: TransparencyLevel.PUBLIC,
    title: 'Public',
    description:
      'Access to your space activity is not restricted and visible publicly.',
    disabled: false,
  },
  {
    id: TransparencyLevel.NETWORK,
    title: 'Network',
    description:
      'Access to your spaces activity is restricted to Hypha Network members.',
    disabled: false,
  },
  {
    id: TransparencyLevel.ORGANISATION,
    title: 'Organisation',
    description:
      'Access to your space activity is restricted to members of your organisation.',
    disabled: false,
  },
  {
    id: TransparencyLevel.SPACE,
    title: 'Space',
    description:
      'Access to your space activity is restricted to space members.',
    disabled: false,
  },
];

export function SpaceActivityAccessField({
  value,
  onChange,
}: {
  value?: TransparencyLevel;
  onChange?: (selected: TransparencyLevel) => void;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name="spaceActivityAccess"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <TransparencyLevelComponent
              onChange={onChange}
              value={(field.value as TransparencyLevel) ?? value}
              options={activityAccessOptions}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
