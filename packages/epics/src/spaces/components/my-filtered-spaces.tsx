'use client';

import { Locale } from '@hypha-platform/i18n';
import {
  Address,
  Space,
  SpaceOrder,
  isSpaceArchived,
} from '@hypha-platform/core/client';
import { SpaceCardList, useMemberWeb3SpaceIds } from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';
import React from 'react';
import { Text } from '@radix-ui/themes';
import { useFilterSpacesListWithDiscoverability } from '../hooks/use-spaces-discoverability-batch';
import { SectionFilter, Input } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

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

function sortSpacesByOrder(spaces: Space[], order?: SpaceOrder): Space[] {
  const compareMembers = (a: Space, b: Space) => {
    const aCount = a.memberAddresses?.length ?? a.memberCount ?? 0;
    const bCount = b.memberAddresses?.length ?? b.memberCount ?? 0;
    return bCount - aCount;
  };
  const compareAgreements = (a: Space, b: Space) =>
    (b.documentCount ?? 0) - (a.documentCount ?? 0);
  const compareRecent = (a: Space, b: Space) => b.id - a.id;

  return [...spaces].sort((a, b) => {
    switch (order) {
      case 'mostmembers':
        return compareMembers(a, b);
      case 'mostagreements':
        return compareAgreements(a, b);
      case 'mostrecent':
        return compareRecent(a, b);
      default:
        return compareMembers(a, b);
    }
  });
}

export function MyFilteredSpaces({
  lang,
  spaces,
  order,
  showLoadMore = true,
}: {
  lang: Locale;
  spaces: Space[];
  order?: SpaceOrder;
  showLoadMore?: boolean;
}) {
  const { person, isLoading: isLoadingPerson } = useMe();
  const { web3SpaceIds, isLoading: isLoadingMemberSpaceIds } =
    useMemberWeb3SpaceIds({
      personAddress: person?.address as Address | undefined,
    });
  const [hideArchivedSpaces, setHideArchivedSpaces] = React.useState(true);
  const tSpaces = useTranslations('Spaces');
  const tMyWallet = useTranslations('MyWallet');

  const memberFilteredSpaces = React.useMemo(
    () => filterSpaces(spaces, person?.slug, web3SpaceIds),
    [spaces, person, web3SpaceIds],
  );

  const { filteredSpaces, isLoading: isDiscoverabilityLoading } =
    useFilterSpacesListWithDiscoverability({
      spaces: memberFilteredSpaces,
      useGeneralState: false,
    });

  const isLoadingSpaces =
    isLoadingPerson ||
    (Boolean(person?.address) && isLoadingMemberSpaceIds) ||
    isDiscoverabilityLoading;

  const displayedSpaces = React.useMemo(() => {
    const visibleSpaces = hideArchivedSpaces
      ? filteredSpaces.filter((space) => !isSpaceArchived(space))
      : filteredSpaces;
    return sortSpacesByOrder(visibleSpaces, order);
  }, [filteredSpaces, hideArchivedSpaces, order]);

  return (
    <div className="space-y-6">
      <SectionFilter
        count={isLoadingSpaces ? tMyWallet('loading') : displayedSpaces.length}
        label={tSpaces('mySpacesLabel')}
      >
        <label
          htmlFor="hide-archived-spaces"
          className="flex items-center gap-1"
        >
          <Input
            id="hide-archived-spaces"
            type="checkbox"
            checked={hideArchivedSpaces}
            onChange={(e) => setHideArchivedSpaces(e.target.checked)}
            className="h-4 w-4"
          />
          <span>{tSpaces('hideArchivedSpaces')}</span>
        </label>
      </SectionFilter>
      {isLoadingSpaces ? (
        <Text className="text-3 text-muted-foreground">
          {tMyWallet('loading')}
        </Text>
      ) : (
        <SpaceCardList
          lang={lang}
          spaces={displayedSpaces}
          showLoadMore={showLoadMore}
          showExitButton={true}
          cardGridClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        />
      )}
    </div>
  );
}
