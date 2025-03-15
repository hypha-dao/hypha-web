import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';
import { config } from '@hypha-platform/evm';
import { readContract } from '@wagmi/core';

export const isMember = async ({
  spaceId,
  memberAddress,
  chain = 8453,
}: {
  spaceId: bigint;
  memberAddress: `0x${string}`;
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  const result = await readContract(config, {
    address,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'isMember',
    args: [spaceId, memberAddress],
  });

  return result;
};
