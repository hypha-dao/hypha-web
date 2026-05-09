import { daoSpaceFactoryImplementationAddress } from '@hypha-platform/core/generated';
import { publicClient } from '../../../common/web3/public-client';
import { getSpaceDetails } from './get-space-details';

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
  allowFailure = false,
}: {
  spaceIds: bigint[];
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
  /** When true, failed per-space reads are omitted instead of failing the whole batch. */
  allowFailure?: boolean;
}): Promise<SpaceDetails[]> => {
  if (spaceIds.length === 0) return [];

  const multicallParams = spaceIds.map((spaceId) =>
    getSpaceDetails({ spaceId, chain }),
  );
  try {
    if (allowFailure) {
      const response = await publicClient.multicall({
        allowFailure: true,
        blockTag: 'safe',
        contracts: multicallParams,
      });
      if (response.length !== spaceIds.length) {
        throw new Error('Response length is different from input length');
      }

      const mapped: SpaceDetails[] = [];
      for (let i = 0; i < response.length; i++) {
        const res = response[i]!;
        if (res.status !== 'success' || res.result === undefined) {
          continue;
        }
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
        ] = res.result;
        mapped.push({
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
        });
      }
      return mapped;
    }

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
  } catch (error) {
    throw new Error('Failed to get space details', { cause: error });
  }
};
