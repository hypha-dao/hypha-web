'use client';

import { useMemo } from 'react';
import { useSpaceDetailsWeb3Rpc } from '@hypha-platform/core/client';
import { useSpaceTokenRequirements } from '../../spaces';
import { Space } from '@hypha-platform/core/client';
import { zeroAddress } from 'viem';
import { useAssets } from '../../treasury';

interface Props {
  spaceAddress?: string | null;
  spaces?: Space[];
}

export const useSpaceTokenRequirementsByAddress = ({
  spaceAddress,
  spaces,
}: Props) => {
  const { assets } = useAssets({ filter: { type: 'all' } });

  const normalizedAddress = spaceAddress?.toUpperCase();

  const selectedSpace = useMemo(() => {
    return spaces?.find((s) => s.address?.toUpperCase() === normalizedAddress);
  }, [spaces, normalizedAddress]);

  const web3SpaceId = selectedSpace?.web3SpaceId;
  const hasValidWeb3Id = web3SpaceId !== undefined && web3SpaceId !== null;

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: hasValidWeb3Id ? Number(web3SpaceId) : 0,
  });

  const isTokenBased = spaceDetails?.joinMethod === 1n;

  const spaceTokenRequirements = useSpaceTokenRequirements({
    spaceId: hasValidWeb3Id ? BigInt(web3SpaceId) : 0n,
  });

  const [tokenAddress, requiredAmountRaw] =
    spaceTokenRequirements?.requirements ?? [];

  const requiredAmount = requiredAmountRaw ? Number(requiredAmountRaw) : 0;

  const hasTokenRequirements = useMemo(() => {
    return (
      isTokenBased &&
      typeof tokenAddress === 'string' &&
      tokenAddress.toLowerCase() !== zeroAddress.toLowerCase() &&
      requiredAmount > 0
    );
  }, [isTokenBased, tokenAddress, requiredAmount]);

  const asset = assets?.find(
    (a) => a.address?.toLowerCase() === tokenAddress?.toLowerCase(),
  );

  const hasEnoughTokens = useMemo(() => {
    if (!hasTokenRequirements || !asset || asset.value === undefined)
      return false;
    return asset.value >= requiredAmount;
  }, [hasTokenRequirements, asset, requiredAmount]);

  const missingTokenMessage = useMemo(() => {
    if (!hasTokenRequirements || hasEnoughTokens || !asset) return null;

    const formattedRequired = requiredAmount.toFixed(2);
    const formattedCurrent = asset.value.toFixed(2);

    return `Not enough tokens to join this space. Required: ${formattedRequired}, available: ${formattedCurrent}`;
  }, [hasTokenRequirements, hasEnoughTokens, asset, requiredAmount]);

  const loading = !selectedSpace || spaceDetails === undefined;
  const error = !hasValidWeb3Id && !!selectedSpace;

  return {
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
