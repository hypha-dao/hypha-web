import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import { base } from 'viem/chains';

export type RemoveMemberWeb3Input = {
  spaceId: bigint;
  memberAddress: `0x${string}`;
};

export type RemoveMemberWeb3Config = {
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
};

export const removeMember = (
  {
    spaceId,
    memberAddress,
  }: {
    spaceId: bigint;
    memberAddress: `0x${string}`;
  },
  { chain = base.id }: RemoveMemberWeb3Config = {},
) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  const callConfig = {
    address,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'removeMember' as const,
    args: [spaceId, memberAddress] as const,
  };
  return callConfig;
};
