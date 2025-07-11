'use client';

import { publicClient } from '@core/common';
import { getTokensVotingPower, getOwnershipTokensVotingPower } from '../web3';
import useSWR from 'swr';
import { ethers } from 'ethers';

const isZeroAddress = (address: string): boolean => {
  return address === ethers.ZeroAddress;
};

export const useTokensVotingPower = ({ spaceId }: { spaceId: bigint }) => {
  const {
    data: tokenVotingPower,
    isLoading: isLoadingTokens,
    error: tokensError,
  } = useSWR(
    [spaceId, 'tokensVotingPower'],
    async ([spaceId]) =>
      publicClient.readContract(
        getTokensVotingPower({ spaceId }),
      ) as Promise<`0x${string}`>,
    { revalidateOnFocus: true },
  );

  const {
    data: ownershipTokenVotingPower,
    isLoading: isLoadingOwnership,
    error: ownershipError,
  } = useSWR(
    [spaceId, 'ownershipTokensVotingPower'],
    async ([spaceId]) =>
      publicClient.readContract(
        getOwnershipTokensVotingPower({ spaceId }),
      ) as Promise<`0x${string}`>,
    { revalidateOnFocus: true },
  );

  const hasVotingTokens =
    !isZeroAddress(tokenVotingPower || '0x') ||
    !isZeroAddress(ownershipTokenVotingPower || '0x');

  return {
    hasVotingTokens,
    isLoading: isLoadingTokens || isLoadingOwnership,
    error: tokensError || ownershipError,
  };
};
