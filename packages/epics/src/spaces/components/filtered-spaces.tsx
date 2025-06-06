'use client';

import { Locale } from '@hypha-platform/i18n';
import { Space } from '@core/space';
import {
  UseMembers,
  SpacesWithFilter,
  useMemberWeb3SpaceIds,
} from '@hypha-platform/epics';
import { useState } from 'react';
import { Person, useMe } from '@core/people';
import React from 'react';

function filterSpaces(
  spaces: Space[],
  user: Person | undefined,
  mySpaces: boolean,
  web3SpaceIds: readonly bigint[] | undefined,
) {
  if (!mySpaces || !user?.slug || !web3SpaceIds) {
    return spaces;
  }
  const userSpaces: Space[] = spaces.filter((space) => {
    const spaceId = space.web3SpaceId ? BigInt(space.web3SpaceId) : null;
    return spaceId !== null && web3SpaceIds.includes(spaceId);
  });
  return userSpaces;
}

function isMySpace(value: string): boolean {
  return value == 'my-spaces';
}

export function FilteredSpaces({
  lang,
  spaces,
  useMembers,
}: {
  lang: Locale;
  spaces: Space[];
  useMembers: UseMembers;
}) {
  const { person: user } = useMe();
  const { web3SpaceIds } = useMemberWeb3SpaceIds();
  const [showMySpaces, setShowMySpaces] = useState(true);

  const handleChangeFilter = (value: string) => {
    const mySpacesOnly = isMySpace(value);
    setShowMySpaces(mySpacesOnly);
  };

  const filteredSpaces = React.useMemo(
    () => filterSpaces(spaces, user, showMySpaces, web3SpaceIds),
    [spaces, user, showMySpaces, web3SpaceIds],
  );

  return (
    <SpacesWithFilter
      lang={lang}
      spaces={filteredSpaces}
      showMySpaces={showMySpaces}
      useMembers={useMembers}
      handleChangeFilter={handleChangeFilter}
    />
  );
}
