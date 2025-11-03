'use client';

import {
  publicClient,
  useSpaceDetailsWeb3Rpc,
  ALLOWED_SPACES,
} from '@hypha-platform/core/client';
import {
  getTokensVotingPower,
  getOwnershipTokensVotingPower,
  getVoiceTokensVotingPower,
} from '../web3';
import useSWR from 'swr';
import { ethers } from 'ethers';

const isZeroAddress = (address: string): boolean => {
  return address === ethers.ZeroAddress;
};

export const useTokensVotingPower = ({ spaceId }: { spaceId: bigint }) => {
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: Number(spaceId),
  });
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

  const {
    data: voiceTokenVotingPower,
    isLoading: isLoadingVoice,
    error: voiceError,
  } = useSWR(
    [spaceId, 'voiceTokensVotingPower'],
    async ([spaceId]) =>
      publicClient.readContract(
        getVoiceTokensVotingPower({ spaceId }),
      ) as Promise<`0x${string}`>,
    { revalidateOnFocus: true },
  );

  const isAllowedSpace = spaceDetails?.executor
    ? ALLOWED_SPACES.includes(spaceDetails.executor)
    : false;

  const hasVotingTokens =
    isAllowedSpace ||
    !isZeroAddress(tokenVotingPower || '0x') ||
    !isZeroAddress(ownershipTokenVotingPower || '0x');

  return {
    votingPowerToken: tokenVotingPower,
    ownershipPowerToken: ownershipTokenVotingPower,
    voicePowerToken: voiceTokenVotingPower,
    hasVotingTokens,
    isLoading: isLoadingTokens || isLoadingOwnership || isLoadingVoice,
    error: tokensError || ownershipError || voiceError,
  };
};
