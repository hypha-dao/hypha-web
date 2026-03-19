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
import { Separator } from '@hypha-platform/ui';
import { ERC20_TOKEN_TRANSFER_ADDRESSES } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
  type?: string;
  space?: {
    title: string;
    slug: string;
  };
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
  const tActions = useTranslations('ProfileActions');
  const { assets, manualUpdate } = useUserAssets({
    personSlug,
    refreshInterval: 10000,
  });
  const tokens: Token[] = assets
    .filter(
      (asset) =>
        (asset.type != null && !['ownership', 'voice'].includes(asset.type)) ||
        (asset.type == null &&
          ERC20_TOKEN_TRANSFER_ADDRESSES.includes(asset.address)),
    )
    .map((asset) => ({
      icon: asset.icon,
      symbol: asset.symbol,
      address: asset.address as `0x${string}`,
      type: asset.type,
      space: asset.space,
    }));

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <h2 className="text-4 text-secondary-foreground justify-start items-center">
            {tActions('transferFunds.title')}
          </h2>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label={tActions('backToActions')}
              backUrl={`/${lang}/profile/${personSlug}/actions`}
            />
            <ButtonClose closeUrl={`/${lang}/profile/${personSlug}`} />
          </div>
        </div>
        <span className="text-2 text-neutral-11">
          {tActions('transferFunds.content')}
        </span>
        <Separator />
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
