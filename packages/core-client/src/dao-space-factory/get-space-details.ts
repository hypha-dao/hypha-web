import { readContract } from '@wagmi/core';
import { config } from '../config';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '../generated';

export const getSpaceDetails = async ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  const [
    name,
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
    name,
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
