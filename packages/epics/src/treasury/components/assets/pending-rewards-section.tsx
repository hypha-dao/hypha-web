'use client';

import { FC, useCallback } from 'react';
import { SectionFilter } from '@hypha-platform/ui/server';
import { type Person, usePendingRewards } from '@hypha-platform/core/client';
import { AssetCard } from './asset-card';
import { useUserAssetsSection } from '../../hooks';
import { Button } from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';

const HYPHA_TOKEN_ADDRESS = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';

type PendingRewardsSectionProps = {
  person: Person;
  isMyProfile?: boolean;
};

export const PendingRewardsSection: FC<PendingRewardsSectionProps> = ({
  person,
  isMyProfile,
}) => {
  const {
    filteredAssets,
    updateUserAssets,
    isLoading: isLoadingAssets,
  } = useUserAssetsSection({
    personSlug: person?.slug,
  });

  const { pendingRewards, isLoading, claim, isClaiming, updatePendingRewards } =
    usePendingRewards({ user: person?.address as `0x${string}` });

  const originalAsset = filteredAssets?.find(
    (a) => a.address === HYPHA_TOKEN_ADDRESS,
  );

  const parsedRewardValue =
    pendingRewards !== undefined ? Number(pendingRewards / 10n ** 18n) : 0;

  const hyphaTokenAsset =
    originalAsset && pendingRewards !== undefined
      ? {
          ...originalAsset,
          value: parsedRewardValue,
        }
      : undefined;
  const disableClaimButton =
    !(parsedRewardValue >= 0.01) || isClaiming || pendingRewards === undefined;
  const onHandleClaim = useCallback(async () => {
    await claim();
    await updatePendingRewards();
    await updateUserAssets();
  }, [claim, updatePendingRewards, updateUserAssets]);

  return (
    <div className="flex flex-col w-full justify-center items-center gap-3">
      <div className="w-full flex justify-between">
        <SectionFilter label="Rewards" />
        <Button
          title={
            !isMyProfile
              ? 'Claim is only available on your personal page'
              : disableClaimButton
              ? 'The reward value must be greater than 0'
              : ''
          }
          disabled={!isMyProfile || disableClaimButton}
          onClick={onHandleClaim}
        >
          {isClaiming && <Loader2 className="animate-spin w-4 h-4" />}
          Claim
        </Button>
      </div>
      <div className="w-full">
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <AssetCard {...hyphaTokenAsset} isLoading={isLoadingAssets} />
        </div>
        {isLoading && <AssetCard isLoading />}
      </div>
    </div>
  );
};
