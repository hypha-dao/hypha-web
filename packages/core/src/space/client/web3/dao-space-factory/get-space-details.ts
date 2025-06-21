import { publicClient } from '@core/common/web3';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';

export const getSpaceDetails = async ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  const [
    unity,
    quorum,
    votingPowerSource,
    tokenAddresses,
    members,
    exitMethod,
    joinMethod,
    createdAt,
    creator,
    executor,
  ] = await publicClient.readContract({
    address,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'getSpaceDetails',
    args: [spaceId],
  });

  return {
    unity,
    quorum,
    votingPowerSource,
    tokenAddresses,
    members,
    exitMethod,
    joinMethod,
    createdAt,
    creator,
    executor,
  };
};
