'use client';

import { Locale } from '@hypha-platform/i18n';
import { Address, Space } from '@hypha-platform/core/client';
import { SpaceCardList, useMemberWeb3SpaceIds } from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';
import React from 'react';
import { Text } from '@radix-ui/themes';
import { useFilterSpacesListWithDiscoverability } from '../hooks/use-spaces-discoverability-batch';

export function filterSpaces(
  spaces: Space[],
  personSlug: string | undefined,
  web3SpaceIds: readonly bigint[] | undefined,
) {
  if (!personSlug || !web3SpaceIds) {
    return [];
  }
  const userSpaces: Space[] = spaces.filter((space) => {
    const spaceId = space.web3SpaceId ? BigInt(space.web3SpaceId) : null;
    return spaceId !== null && web3SpaceIds.includes(spaceId);
  });
  return userSpaces;
}

export function MyFilteredSpaces({
  lang,
  spaces,
  showLoadMore = true,
}: {
  lang: Locale;
  spaces: Space[];
  showLoadMore?: boolean;
}) {
  const { person } = useMe();
  const { web3SpaceIds } = useMemberWeb3SpaceIds({
    personAddress: person?.address as Address | undefined,
  });

  const memberFilteredSpaces = React.useMemo(
    () => filterSpaces(spaces, person?.slug, web3SpaceIds),
    [spaces, person, web3SpaceIds],
  );

  const { filteredSpaces, isLoading: isDiscoverabilityLoading } =
    useFilterSpacesListWithDiscoverability({
      spaces: memberFilteredSpaces,
      useGeneralState: false,
    });

  return (
    <div className="space-y-6">
      <div className="justify-between items-center flex">
        <Text className="text-4">My Spaces | {filteredSpaces.length}</Text>
      </div>
      <SpaceCardList
        lang={lang}
        spaces={filteredSpaces}
        showLoadMore={showLoadMore}
        showExitButton={true}
      />
    </div>
  );
}
