import { daoSpaceFactoryImplementationAddress } from '@hypha-platform/core/generated';
import { publicClient, getSpaceDetails } from '@hypha-platform/core/client';

export interface SpaceDetails {
  spaceId: bigint;
  unity: bigint;
  quorum: bigint;
  votingPowerSource: bigint;
  tokenAddresses: readonly `0x${string}`[];
  members: readonly `0x${string}`[];
  exitMethod: bigint;
  joinMethod: bigint;
  createdAt: bigint;
  creator: `0x${string}`;
  executor: `0x${string}`;
}

export const fetchSpaceDetails = async ({
  spaceIds,
  chain = 8453,
}: {
  spaceIds: bigint[];
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}): Promise<SpaceDetails[]> => {
  if (spaceIds.length === 0) return [];

  const multicallParams = spaceIds.map((spaceId) =>
    getSpaceDetails({ spaceId, chain }),
  );
  try {
    const response = await publicClient.multicall({
      allowFailure: false,
      blockTag: 'safe',
      contracts: multicallParams,
    });
    if (response.length !== spaceIds.length) {
      throw new Error('Response length is different from input length');
    }

    return response.map((res, i) => {
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
      ] = res;

      return {
        // the element will always be there because their lengths are equal
        spaceId: spaceIds[i]!,
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
    });
  } catch (e) {
    throw new Error(`Failed to get space details: ${e}`);
  }
};
