'use client';

import useSWR from 'swr';
import { Address } from '@hypha-platform/core/client';
import {
  getMemberSpaces,
  publicClient,
  getSpacesForDelegate,
  getDelegators,
  getSpaceDetails,
} from '@hypha-platform/core/client';

export function useMemberWeb3SpaceIds({
  personAddress,
}: {
  personAddress: Address | undefined;
}) {
  const {
    data: web3SpaceIds,
    isLoading,
    error,
  } = useSWR(
    personAddress ? [personAddress, 'getMemberAndDelegatedSpaces'] : null,
    async ([address]) => {
      const [memberSpaces, delegatedSpaces] = await Promise.all([
        publicClient.readContract(getMemberSpaces({ memberAddress: address })),
        publicClient.readContract(
          getSpacesForDelegate({ user: address as `0x${string}` }),
        ),
      ]);

      const filteredDelegated = (
        await Promise.all(
          (delegatedSpaces ?? []).map(async (spaceId) => {
            const delegators = await publicClient.readContract(
              getDelegators({
                user: address as `0x${string}`,
                spaceId,
              }),
            );
            const spaceDetailsRaw = await publicClient.readContract(
              getSpaceDetails({ spaceId }),
            );
            const [
              unity,
              quorum,
              votingPowerSource,
              tokenAdresses,
              members,
              exitMethod,
              joinMethod,
              createdAt,
              creator,
              executor,
            ] = spaceDetailsRaw;
            const isValid = delegators.some((delegator: Address) =>
              members.includes(delegator),
            );
            return isValid ? spaceId : null;
          }),
        )
      ).filter((id): id is bigint => id !== null);

      const allSpaces = Array.from(
        new Set([...(memberSpaces ?? []), ...filteredDelegated]),
      );

      return allSpaces;
    },
    { revalidateOnFocus: true },
  );

  return {
    web3SpaceIds,
    isLoading,
    error,
  };
}
