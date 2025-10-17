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
import { TOKENS } from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';

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

  // TODO: temporarily hidden until there is a way to transfer space tokens without whitelisting them
  // const tokens: Token[] = assets
  //   .filter((asset) => !['ownership', 'voice'].includes(asset.type))
  //   .map((asset) => ({
  //     icon: asset.icon,
  //     symbol: asset.symbol,
  //     address: asset.address as `0x${string}`,
  //   }));

  const transferableTokens = TOKENS.filter(({ transferable }) => transferable);

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <h2 className="text-4 text-secondary-foreground justify-start items-center">
            Transfer Funds
          </h2>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label="Back to actions"
              backUrl={`/${lang}/profile/${personSlug}/actions`}
            />
            <ButtonClose closeUrl={`/${lang}/profile/${personSlug}`} />
          </div>
        </div>
        <span className="text-2 text-neutral-11">
          Easily send funds from your wallet to a member or a space.
        </span>
        <Separator />
        <PeopleTransferForm
          peoples={peoples}
          spaces={spaces}
          tokens={transferableTokens}
          updateAssets={manualUpdate}
        />
      </div>
    </SidePanel>
  );
};
