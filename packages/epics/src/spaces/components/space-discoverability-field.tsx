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

const discoverabilityOptions: TransparencyOption[] = [
  {
    id: TransparencyLevel.PUBLIC,
    title: 'Public',
    description: 'Your space is publicly discoverable.',
    disabled: false,
  },
  {
    id: TransparencyLevel.NETWORK,
    title: 'Network',
    description: 'Your space is only discoverable by Hypha Network Members.',
    disabled: false,
  },
  {
    id: TransparencyLevel.ORGANISATION,
    title: 'Organisation',
    description:
      'Your space is only discoverable by members of your organisation.',
    disabled: false,
  },
  {
    id: TransparencyLevel.SPACE,
    title: 'Space',
    description: 'Your space is only discoverable by space members.',
    disabled: false,
  },
];

export function SpaceDiscoverabilityField({
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
      name="spaceDiscoverability"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <TransparencyLevelComponent
              onChange={onChange}
              value={(field.value as TransparencyLevel) ?? value}
              options={discoverabilityOptions}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
