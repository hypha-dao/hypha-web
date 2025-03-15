import { readContract, type Config } from '@wagmi/core';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';

export const getSpaceDetails = async (
  {
    spaceId,
    chain = 8453,
  }: {
    spaceId: bigint;
    chain?: keyof typeof daoSpaceFactoryImplementationAddress;
  },
  config: Config,
) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  const [
    unity,
    quorum,
    votingPowerSource,
    tokenAdresses,
    members,
    exitMthod,
    joinMethod,
    createdAt,
    creator,
    executor,
  ] = await readContract(config, {
    address,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'getSpaceDetails',
    args: [spaceId],
  });

  return {
    unity,
    quorum,
    votingPowerSource,
    tokenAdresses,
    members,
    exitMthod,
    joinMethod,
    createdAt,
    creator,
    executor,
  };
};
