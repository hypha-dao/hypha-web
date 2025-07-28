import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import { publicClient } from '@hypha-platform/core/client';

export interface SpaceDetails {
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

export const getSpaceDetails = async ({
  spaceIds: spaceIds,
  chain = 8453,
}: {
  spaceIds: bigint[];
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}): Promise<Map<bigint, SpaceDetails>> => {
  if (spaceIds.length === 0) return new Map();

  const address = daoSpaceFactoryImplementationAddress[chain];

  const params = spaceIds.map(
    (id) =>
      ({
        address,
        abi: daoSpaceFactoryImplementationAbi,
        functionName: 'getSpaceDetails',
        args: [id],
      } as const),
  );

  try {
    const response = await publicClient.multicall({
      allowFailure: false,
      blockTag: 'safe',
      contracts: params,
    });
    if (response.length !== spaceIds.length) {
      throw new Error('Response length is different from input length');
    }

    const details = response.map((res) => {
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

    return new Map<bigint, SpaceDetails>(
      // Arrays will have the same length at this point
      spaceIds.map((id, i) => [id, details[i] as SpaceDetails]),
    );
  } catch (e) {
    throw new Error(`Failed to get space details: ${e}`);
  }
};
