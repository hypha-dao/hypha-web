'use client';

import React from 'react';
import {
  SidePanel,
  ButtonClose,
  ButtonBack,
  useUserAssets,
} from '@hypha-platform/epics';
import { PeopleTransferForm } from '@hypha-platform/epics';
import { Person } from '../../../../core/src/people';
import { Space } from '../../../../core/src/space';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
}

interface ProfileTransferFundsProps {
  lang: string;
  spaces: Space[];
  peoples: Person[];
  personSlug: string;
}

export const ProfileTransferFunds = ({
  lang,
  spaces,
  peoples,
  personSlug,
}: ProfileTransferFundsProps) => {
  const { assets, manualUpdate } = useUserAssets({
    personSlug,
    refreshInterval: 10000,
  });

  const tokens: Token[] = assets.map((asset) => ({
    icon: asset.icon,
    symbol: asset.symbol,
    address: asset.address as `0x${string}`,
  }));

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <span className="text-4 text-secondary-foreground justify-start items-center">
            Transfer Funds
          </span>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label="Back to wallet"
              backUrl={`/${lang}/profile/${personSlug}/wallet`}
            />
            <ButtonClose closeUrl={`/${lang}/profile/${personSlug}`} />
          </div>
        </div>
        <PeopleTransferForm
          peoples={peoples}
          spaces={spaces}
          tokens={tokens}
          updateAssets={manualUpdate}
        />
      </div>
    </SidePanel>
  );
};
