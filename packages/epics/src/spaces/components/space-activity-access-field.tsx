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
import { useTranslations } from 'next-intl';

export function SpaceActivityAccessField({
  value,
  onChange,
}: {
  value?: TransparencyLevel;
  onChange?: (selected: TransparencyLevel) => void;
}) {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const activityAccessOptions: TransparencyOption[] = [
    {
      id: TransparencyLevel.PUBLIC,
      title: tAgreementFlow('plugins.transparency.publicTitle'),
      description: tAgreementFlow('plugins.transparency.activityPublic'),
      disabled: false,
    },
    {
      id: TransparencyLevel.NETWORK,
      title: tAgreementFlow('plugins.transparency.networkTitle'),
      description: tAgreementFlow('plugins.transparency.activityNetwork'),
      disabled: false,
    },
    {
      id: TransparencyLevel.ORGANISATION,
      title: tAgreementFlow('plugins.transparency.organisationTitle'),
      description: tAgreementFlow('plugins.transparency.activityOrganisation'),
      disabled: false,
    },
    {
      id: TransparencyLevel.SPACE,
      title: tAgreementFlow('plugins.transparency.spaceTitle'),
      description: tAgreementFlow('plugins.transparency.activitySpace'),
      disabled: false,
    },
  ];
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
