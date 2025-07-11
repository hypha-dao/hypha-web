import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import { base } from 'viem/chains';

export type JoinSpaceWeb3Input = {
  spaceId: bigint;
  memberAddress: `0x${string}`;
};

export type JoinSpaceWeb3Config = {
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
};

export const joinSpace = (
  {
    spaceId,
  }: {
    spaceId: bigint;
  },
  { chain = base.id }: JoinSpaceWeb3Config = {},
) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  const callConfig = {
    address,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'joinSpace' as const,
    args: [spaceId] as const,
  };
  return callConfig;
};
