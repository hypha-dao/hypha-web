'use client';

import { FC, ReactNode, useCallback, useEffect, useState } from 'react';
import {
  usePendingRewards,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { hyphaTokenAddress } from '@hypha-platform/core/generated';
import { AssetCard } from './asset-card';
import { useAssetsSection, useTokenSupply } from '../../hooks';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useSpaceMember } from '../../../spaces';
import { useParams } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { useTranslations } from 'next-intl';

const HYPHA_TOKEN_ADDRESS = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';

const HYPHA_REWARDS_FALLBACK = {
  icon: '/placeholder/hypha-token-icon.svg',
  name: 'Hypha',
  symbol: 'HYPHA',
  value: 0,
  address: HYPHA_TOKEN_ADDRESS,
};

type SpacePendingRewardsSectionProps = {
  web3SpaceId: number;
  toolbarActions?: ReactNode;
  onVisibleRewardCountChange?: (count: number) => void;
  /** When the page already shows a Rewards title, demote this to amount-only meta. */
  compactHeader?: boolean;
};

export const SpacePendingRewardsSection: FC<
  SpacePendingRewardsSectionProps
> = ({
  web3SpaceId,
  toolbarActions,
  onVisibleRewardCountChange,
  compactHeader = false,
}) => {
  const tTreasury = useTranslations('TreasuryTab');
  const { id: spaceSlug } = useParams<{ id: string }>();
  const { mutate } = useSWRConfig();
  const { isAuthenticated } = useAuthentication();
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({ spaceId: web3SpaceId });
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId });
  const executor = spaceDetails?.executor as `0x${string}` | undefined;

  const { filteredAssets, isLoading: isLoadingAssets } = useAssetsSection();

  // Always use canonical HyphaToken for rewards (matches claim-rewards.ts script).
  // Assets API excludes HYPHA for spaces not in ALLOWED_SPACES, and space-specific
  // tokens from assets may point to wrong contract. Rewards are on main contract.
  const rewardsHyphaTokenAddress = (hyphaTokenAddress[8453] ??
    HYPHA_TOKEN_ADDRESS) as `0x${string}`;

  const hyphaTokenAddressForDisplay =
    filteredAssets?.find(
      (a) => a.symbol === 'HYPHA' || a.address === HYPHA_TOKEN_ADDRESS,
    )?.address ?? HYPHA_TOKEN_ADDRESS;

  const { supply: hyphaTotalSupply } = useTokenSupply(rewardsHyphaTokenAddress);

  const {
    pendingRewards,
    isLoading,
    claim,
    waitForClaimReceipt,
    isClaiming,
    updatePendingRewards,
  } = usePendingRewards({
    user: executor,
    hyphaTokenAddress: rewardsHyphaTokenAddress,
  });

  const [hasClaimed, setHasClaimed] = useState(false);

  const originalAsset = filteredAssets?.find(
    (a) =>
      a.address.toLowerCase() === hyphaTokenAddressForDisplay.toLowerCase(),
  );

  const parsedRewardValue =
    pendingRewards !== undefined ? Number(pendingRewards) / 1e18 : 0;

  const baseHyphaAsset = originalAsset
    ? { ...originalAsset, value: parsedRewardValue }
    : {
        ...HYPHA_REWARDS_FALLBACK,
        address: hyphaTokenAddressForDisplay,
        value: parsedRewardValue,
      };

  const supplyFromAsset = (originalAsset as { supply?: { total: number } })
    ?.supply;
  const supply =
    supplyFromAsset ??
    (hyphaTotalSupply !== undefined ? { total: hyphaTotalSupply } : undefined);

  const hyphaTokenAsset =
    pendingRewards !== undefined ? { ...baseHyphaAsset, supply } : undefined;

  useEffect(() => {
    if (parsedRewardValue > 0) {
      setHasClaimed(false);
    }
  }, [parsedRewardValue]);

  useEffect(() => {
    if (pendingRewards !== undefined) {
      const displayValue =
        parsedRewardValue >= 0.0001
          ? parsedRewardValue.toFixed(4)
          : parsedRewardValue.toFixed(18).replace(/\.?0+$/, '');
      console.log(
        `[Space ${web3SpaceId}] Rewards: ${displayValue} HYPHA (raw: ${pendingRewards.toString()}) | executor: ${
          executor ?? 'loading'
        } | hyphaToken: ${rewardsHyphaTokenAddress}`,
      );
    }
  }, [
    web3SpaceId,
    pendingRewards,
    parsedRewardValue,
    executor,
    rewardsHyphaTokenAddress,
  ]);

  const updateSpaceAssets = useCallback(() => {
    if (spaceSlug) {
      mutate([`/api/v1/spaces/${spaceSlug}/assets`]);
    }
  }, [mutate, spaceSlug]);

  const hasRewards = (pendingRewards ?? 0n) > 0n;
  const disableClaimButton =
    hasClaimed || !hasRewards || isClaiming || pendingRewards === undefined;

  const canClaim = isAuthenticated && isMember;
  const visibleRewardCount = isAuthenticated && executor ? 1 : 0;

  useEffect(() => {
    onVisibleRewardCountChange?.(visibleRewardCount);
  }, [onVisibleRewardCountChange, visibleRewardCount]);

  const onHandleClaim = useCallback(async () => {
    if (!canClaim || !executor) return;
    try {
      const txHash = await claim();
      await waitForClaimReceipt(txHash as `0x${string}`);
      await updatePendingRewards(0n, { revalidate: true });
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

  return (
    <div className="flex w-full flex-col items-stretch gap-3">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        {compactHeader ? (
          <p className="craft-meta min-w-0 flex-1 tabular-nums">
            {formatCurrencyValue(parsedRewardValue)} HYPHA
          </p>
        ) : (
          <header className="craft-page-header min-w-0 flex-1">
            <h2 className="craft-page-title text-4 font-medium">
              {tTreasury('rewardsSection.title')}
              <span className="ml-2 text-3 font-normal text-muted-foreground tabular-nums">
                | {formatCurrencyValue(parsedRewardValue)} HYPHA
              </span>
            </h2>
          </header>
        )}
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {toolbarActions}
          <Button
            title={
              !isAuthenticated
                ? tTreasury('rewardsSection.signInToClaimRewards')
                : !isMember
                ? tTreasury('rewardsSection.onlySpaceMembersCanClaimRewards')
                : !hasRewards
                ? tTreasury('rewardsSection.noRewardsToClaim')
                : ''
            }
            disabled={!canClaim || disableClaimButton}
            onClick={onHandleClaim}
          >
            {isClaiming && <Loader2 className="animate-spin w-4 h-4" />}
            {tTreasury('rewardsSection.claim')}
          </Button>
        </div>
      </div>
      <div className="w-full max-w-sm">
        {isLoading || !executor ? (
          <AssetCard isLoading layout="solo" />
        ) : (
          <AssetCard
            {...(hyphaTokenAsset ?? {
              ...HYPHA_REWARDS_FALLBACK,
              address: hyphaTokenAddressForDisplay,
              value: parsedRewardValue,
              supply:
                hyphaTotalSupply !== undefined
                  ? { total: hyphaTotalSupply }
                  : undefined,
            })}
            isLoading={isLoadingAssets}
            layout="solo"
          />
        )}
      </div>
    </div>
  );
};
