'use client';

import {
  SpaceDiscoverabilityField,
  SpaceActivityAccessField,
  TransparencyLevel,
} from '@hypha-platform/epics';
import { FormLabel } from '@hypha-platform/ui';
import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';

export const SpaceTransparencySettingsPlugin = ({
  spaceSlug,
}: {
  spaceSlug: string;
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { setValue, control } = useFormContext();

  const spaceDiscoverability = useWatch({
    control,
    name: 'spaceDiscoverability',
    defaultValue: TransparencyLevel.PUBLIC,
  });

  const spaceActivityAccess = useWatch({
    control,
    name: 'spaceActivityAccess',
    defaultValue: TransparencyLevel.ORGANISATION,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <FormLabel className="text-2 w-full">
          {tAgreementFlow('plugins.spaceTransparencySettings.title')}
        </FormLabel>
        <p className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.spaceTransparencySettings.description')}
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <FormLabel className="text-2 w-full">
            {tAgreementFlow('plugins.spaceTransparencySettings.discoverability')}
          </FormLabel>
          <SpaceDiscoverabilityField
            value={spaceDiscoverability as TransparencyLevel}
            onChange={(selected) => {
              setValue('spaceDiscoverability', selected);
            }}
          />
        </div>
        <div className="flex flex-col gap-4">
          <FormLabel className="text-2 w-full">
            {tAgreementFlow('plugins.spaceTransparencySettings.activityAccess')}
          </FormLabel>
          <SpaceActivityAccessField
            value={spaceActivityAccess as TransparencyLevel}
            onChange={(selected) => {
              setValue('spaceActivityAccess', selected);
            }}
          />
        </div>
      </div>
    </div>
  );
};
