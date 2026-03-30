import { daoSpaceFactoryImplementationAddress } from '@hypha-platform/core/generated';
import { publicClient, getSpaceProposals } from '@hypha-platform/core/client';

export interface SpaceProposalsIds {
  spaceId: bigint;
  accepted: readonly bigint[];
  rejected: readonly bigint[];
}

export const fetchSpaceProposalsIds = async ({
  spaceIds,
  chain = 8453,
  allowFailure = false,
}: {
  spaceIds: bigint[];
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
  allowFailure?: boolean;
}): Promise<SpaceProposalsIds[]> => {
  if (spaceIds.length === 0) return [];

  const multicallParams = spaceIds.map((spaceId) =>
    getSpaceProposals({ spaceId, chain }),
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

      const mapped: SpaceProposalsIds[] = [];
      for (let i = 0; i < response.length; i++) {
        const res = response[i]!;
        if (res.status !== 'success' || res.result === undefined) {
          continue;
        }
        const [accepted, rejected] = res.result;
        mapped.push({
          spaceId: spaceIds[i]!,
          accepted,
          rejected,
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
      const [accepted, rejected] = res;

      return {
        spaceId: spaceIds[i]!,
        accepted,
        rejected,
      };
    });
  } catch (e) {
    throw new Error(`Failed to get space proposals ids: ${e}`);
  }
};
