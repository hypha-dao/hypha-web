'use client';

import { Locale } from '@hypha-platform/i18n';
import { Address, Space, isSpaceArchived } from '@hypha-platform/core/client';
import { SpaceCardList, useMemberWeb3SpaceIds } from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';
import React from 'react';
import { Text } from '@radix-ui/themes';
import { useFilterSpacesListWithDiscoverability } from '../hooks/use-spaces-discoverability-batch';
import { SectionFilter, Input } from '@hypha-platform/ui';

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
  const [hideArchivedSpaces, setHideArchivedSpaces] = React.useState(true);

  const memberFilteredSpaces = React.useMemo(
    () => filterSpaces(spaces, person?.slug, web3SpaceIds),
    [spaces, person, web3SpaceIds],
  );

  const { filteredSpaces, isLoading: isDiscoverabilityLoading } =
    useFilterSpacesListWithDiscoverability({
      spaces: memberFilteredSpaces,
      useGeneralState: false,
    });

  const displayedSpaces = React.useMemo(() => {
    if (hideArchivedSpaces) {
      return filteredSpaces.filter((space) => !isSpaceArchived(space));
    }
    return filteredSpaces;
  }, [filteredSpaces, hideArchivedSpaces]);

  return (
    <div className="space-y-6">
      <SectionFilter count={displayedSpaces.length} label="My Spaces">
        <label className="flex items-center gap-1">
          <Input
            type="checkbox"
            checked={hideArchivedSpaces}
            onChange={(e) => setHideArchivedSpaces(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Hide archived spaces</span>
        </label>
      </SectionFilter>
      <SpaceCardList
        lang={lang}
        spaces={displayedSpaces}
        showLoadMore={showLoadMore}
        showExitButton={true}
      />
    </div>
  );
}
