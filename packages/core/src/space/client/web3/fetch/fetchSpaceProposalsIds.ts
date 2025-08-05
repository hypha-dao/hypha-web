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
}: {
  spaceIds: bigint[];
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}): Promise<SpaceProposalsIds[]> => {
  if (spaceIds.length === 0) return [];

  const multicallParams = spaceIds.map((spaceId) =>
    getSpaceProposals({ spaceId, chain }),
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
      const [accepted, rejected] = res;

      return {
        // the element will always be there because their lengths are equal
        spaceId: spaceIds[i]!,
        accepted,
        rejected,
      };
    });
  } catch (e) {
    throw new Error(`Failed to get space proposals ids: ${e}`);
  }
};
