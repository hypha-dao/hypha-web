'use client';

import {
  SpaceDiscoverabilityField,
  SpaceActivityAccessField,
  TransparencyLevel,
} from '@hypha-platform/epics';
import { FormLabel, Label } from '@hypha-platform/ui';
import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

export const SpaceTransparencySettingsPlugin = ({
  spaceSlug,
}: {
  spaceSlug: string;
}) => {
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
          Space Transparency Configuration
        </FormLabel>
        <p className="text-2 text-neutral-11">
          Define the level of transparency you collectively want to apply to
          your space. Please note that, regardless of the choice you make below,
          only direct member can take action in the space.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <FormLabel className="text-2 w-full">Space Discoverability</FormLabel>
          <SpaceDiscoverabilityField
            value={spaceDiscoverability as TransparencyLevel}
            onChange={(selected) => {
              setValue('spaceDiscoverability', selected);
            }}
          />
        </div>
        <div className="flex flex-col gap-4">
          <FormLabel className="text-2 w-full">Space Activity Access</FormLabel>
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
