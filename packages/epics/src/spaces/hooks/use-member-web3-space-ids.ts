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
      console.log('Starting fetcher with address:', address);

      let memberSpaces;
      let delegatedSpaces;
      try {
        [memberSpaces, delegatedSpaces] = await Promise.all([
          publicClient.readContract(
            getMemberSpaces({ memberAddress: address }),
          ),
          publicClient.readContract(
            getSpacesForDelegate({ user: address as `0x${string}` }),
          ),
        ]);
        console.log('Fetched memberSpaces:', memberSpaces);
        console.log('Fetched delegatedSpaces:', delegatedSpaces);
      } catch (fetchError) {
        console.error(
          'Error fetching memberSpaces or delegatedSpaces:',
          fetchError,
        );
        throw fetchError;
      }

      const filteredDelegated = (
        await Promise.all(
          (delegatedSpaces ?? []).map(async (spaceId) => {
            console.log('Processing spaceId:', spaceId.toString());

            let delegators;
            try {
              delegators = await publicClient.readContract(
                getDelegators({
                  user: address as `0x${string}`,
                  spaceId,
                }),
              );
              console.log(
                'Fetched delegators for spaceId',
                spaceId.toString(),
                ':',
                delegators,
              );
            } catch (delegatorsError) {
              console.error(
                'Error fetching delegators for spaceId',
                spaceId.toString(),
                ':',
                delegatorsError,
              );
              return null;
            }

            let spaceDetailsRaw;
            try {
              spaceDetailsRaw = await publicClient.readContract(
                getSpaceDetails({ spaceId }),
              );
              console.log(
                'Fetched spaceDetailsRaw for spaceId',
                spaceId.toString(),
                ':',
                spaceDetailsRaw,
              );
            } catch (detailsError) {
              console.error(
                'Error fetching spaceDetails for spaceId',
                spaceId.toString(),
                ':',
                detailsError,
              );
              return null;
            }

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
            console.log(
              'Parsed members for spaceId',
              spaceId.toString(),
              ':',
              members,
            );
            console.log(
              'Other parsed fields for spaceId',
              spaceId.toString(),
              ':',
              {
                unity,
                quorum,
                votingPowerSource,
                tokenAdresses,
                exitMethod,
                joinMethod,
                createdAt: createdAt.toString(),
                creator,
                executor,
              },
            );

            const isValid = delegators.some((delegator: Address) =>
              members.includes(delegator),
            );
            console.log(
              'isValid for spaceId',
              spaceId.toString(),
              ':',
              isValid,
            );
            console.log(
              'Matching delegators in members:',
              delegators.filter((delegator) => members.includes(delegator)),
            );

            return isValid ? spaceId : null;
          }),
        )
      ).filter((id): id is bigint => id !== null);

      console.log('Filtered delegatedSpaces:', filteredDelegated);

      const allSpaces = Array.from(
        new Set([...(memberSpaces ?? []), ...filteredDelegated]),
      );

      console.log('Final allSpaces:', allSpaces);

      return allSpaces;
    },
    { revalidateOnFocus: true },
  );

  if (error) {
    console.error('SWR error:', error);
  }
  console.log('Current web3SpaceIds data:', web3SpaceIds);
  console.log('isLoading:', isLoading);

  return {
    web3SpaceIds,
    isLoading,
    error,
  };
}
