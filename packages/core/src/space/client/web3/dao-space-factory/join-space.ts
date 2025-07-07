import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';
import { base } from 'viem/chains';

export const joinSpace = (
  {
    spaceId,
    chain = base.id,
  }: {
    spaceId: bigint;
    chain?: keyof typeof daoSpaceFactoryImplementationAddress;
  }
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
