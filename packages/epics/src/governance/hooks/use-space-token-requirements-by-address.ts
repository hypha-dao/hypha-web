'use client';

import { useMemo } from 'react';
import { useSpaceDetailsWeb3Rpc } from '@hypha-platform/core/client';
import { useSpaceTokenRequirements } from '../../spaces';
import { Space } from '@hypha-platform/core/client';
import { zeroAddress } from 'viem';
import { AssetItem, useAssets } from '../../treasury';
import { JoinMethods } from './types';

interface Props {
  spaceAddress?: string | null;
  spaces?: Space[];
}

interface UseSpaceTokenRequirementsResult {
  isTokenBased: boolean;
  hasTokenRequirements: boolean;
  hasEnoughTokens: boolean;
  missingTokenMessage: string | null;
  spaceTokenRequirements: any;
  selectedSpace: Space | undefined;
  loading: boolean;
  error: boolean;
  requiredToken?: AssetItem;
  requiredAmount?: number;
}

export const useSpaceTokenRequirementsByAddress = ({
  spaceAddress,
  spaces,
}: Props): UseSpaceTokenRequirementsResult => {
  const { assets } = useAssets({ filter: { type: 'all' } });

  const normalizedAddress = spaceAddress?.toUpperCase();

  const selectedSpace = useMemo(() => {
    return spaces?.find((s) => s.address?.toUpperCase() === normalizedAddress);
  }, [spaces, normalizedAddress]);

  const web3SpaceId = selectedSpace?.web3SpaceId;
  const hasValidWeb3Id = web3SpaceId !== undefined && web3SpaceId !== null;

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: Number(web3SpaceId as number),
  });

  const web3SpaceIdBigInt = useMemo(() => {
    return web3SpaceId != null ? BigInt(web3SpaceId) : undefined;
  }, [web3SpaceId]);

  const spaceTokenRequirements = useSpaceTokenRequirements({
    spaceId: web3SpaceIdBigInt,
  });

  const [tokenAddress, requiredAmountRaw] =
    spaceTokenRequirements?.requirements ?? [];

  const requiredAmount = requiredAmountRaw ? Number(requiredAmountRaw) : 0;

  const isTokenBased = useMemo(() => {
    return Number(spaceDetails?.joinMethod) === JoinMethods['TOKEN_BASED'];
  }, [spaceDetails]);

  const hasTokenRequirements = useMemo(() => {
    return (
      isTokenBased &&
      tokenAddress?.toLowerCase() !== zeroAddress.toLowerCase() &&
      requiredAmount > 0
    );
  }, [isTokenBased, tokenAddress, requiredAmount]);

  const asset = useMemo(() => {
    return assets?.find(
      (a) => a.address?.toLowerCase() === tokenAddress?.toLowerCase(),
    );
  }, [assets, tokenAddress]);

  const hasEnoughTokens = useMemo(() => {
    if (!hasTokenRequirements || !asset || asset.value === undefined)
      return false;
    return asset.value >= requiredAmount;
  }, [hasTokenRequirements, asset, requiredAmount]);

  const missingTokenMessage = useMemo(() => {
    if (!hasTokenRequirements || hasEnoughTokens) return null;

    return `Your Space cannot join ${selectedSpace?.title} yet. This space requires specific tokens in your treasury. Fulfil the token requirements to gain access. Please contact ${selectedSpace?.title} for more details.`;
  }, [hasTokenRequirements, hasEnoughTokens, selectedSpace?.title]);

  const loading = !selectedSpace || spaceDetails === undefined;
  const error = !hasValidWeb3Id && !!selectedSpace;

  return {
    requiredToken: asset,
    requiredAmount,
    isTokenBased,
    hasTokenRequirements,
    hasEnoughTokens,
    missingTokenMessage,
    spaceTokenRequirements,
    selectedSpace,
    loading,
    error,
  };
};
