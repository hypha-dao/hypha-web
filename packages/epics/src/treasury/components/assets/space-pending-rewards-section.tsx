'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import { SectionFilter } from '@hypha-platform/ui/server';
import {
  usePendingRewards,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { AssetCard } from './asset-card';
import { useAssetsSection } from '../../hooks';
import { Button } from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import { Empty } from '../../../common';
import { useSpaceMember } from '../../../spaces';
import { useParams } from 'next/navigation';
import { useSWRConfig } from 'swr';

const HYPHA_TOKEN_ADDRESS = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
const MIN_REWARD_CLAIM_VALUE = 0.01;

type SpacePendingRewardsSectionProps = {
  web3SpaceId: number;
};

export const SpacePendingRewardsSection: FC<SpacePendingRewardsSectionProps> = ({
  web3SpaceId,
}) => {
  const { id: spaceSlug } = useParams<{ id: string }>();
  const { mutate } = useSWRConfig();
  const { isAuthenticated } = useAuthentication();
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({ spaceId: web3SpaceId });
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId });
  const executor = spaceDetails?.executor as `0x${string}` | undefined;

  const {
    filteredAssets,
    isLoading: isLoadingAssets,
  } = useAssetsSection();

  const {
    pendingRewards,
    isLoading,
    claim,
    waitForClaimReceipt,
    isClaiming,
    updatePendingRewards,
  } = usePendingRewards({ user: executor });

  const [hasClaimed, setHasClaimed] = useState(false);

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

  useEffect(() => {
    if (parsedRewardValue >= MIN_REWARD_CLAIM_VALUE) {
      setHasClaimed(false);
    }
  }, [parsedRewardValue]);

  const updateSpaceAssets = useCallback(() => {
    if (spaceSlug) {
      mutate([`/api/v1/spaces/${spaceSlug}/assets`]);
    }
  }, [mutate, spaceSlug]);

  const disableClaimButton =
    hasClaimed ||
    !(parsedRewardValue >= MIN_REWARD_CLAIM_VALUE) ||
    isClaiming ||
    pendingRewards === undefined;

  const canClaim = isAuthenticated && isMember;

  const hasNoRewards =
    !isLoading &&
    pendingRewards !== undefined &&
    parsedRewardValue === 0;

  const onHandleClaim = useCallback(async () => {
    if (!canClaim || !executor) return;
    try {
      const txHash = await claim();
      await waitForClaimReceipt(txHash as `0x${string}`);
      await updatePendingRewards();
      await updateSpaceAssets();
      setHasClaimed(true);
    } catch (error) {
      console.error('Claim failed:', error);
    }
  }, [
    canClaim,
    executor,
    claim,
    waitForClaimReceipt,
    updatePendingRewards,
    updateSpaceAssets,
  ]);

  if (hasNoRewards) {
    return null;
  }

  return (
    <div className="flex flex-col w-full justify-center items-center gap-3">
      <div className="w-full flex justify-between">
        <SectionFilter label="Rewards" />
        <Button
          title={
            !isAuthenticated
              ? 'Please sign in to claim rewards'
              : !isMember
              ? 'Only space members can claim rewards'
              : disableClaimButton
              ? 'The reward value must be greater than 0'
              : ''
          }
          disabled={!canClaim || disableClaimButton}
          onClick={onHandleClaim}
        >
          {isClaiming && <Loader2 className="animate-spin w-4 h-4" />}
          Claim
        </Button>
      </div>
      <div className="w-full">
        {isLoading || !executor ? (
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <AssetCard isLoading />
          </div>
        ) : !isAuthenticated ? (
          <Empty>
            <p>Sign in to view space rewards</p>
          </Empty>
        ) : (
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <AssetCard {...hyphaTokenAsset} isLoading={isLoadingAssets} />
          </div>
        )}
      </div>
    </div>
  );
};
