'use client';

import { Locale } from '@hypha-platform/i18n';
import { Space } from '@core/space';
import {
  UseMembers,
  useMemberWeb3SpaceIds,
  SpaceCardList,
} from '@hypha-platform/epics';
import { Person, useMe } from '@core/people';
import React from 'react';
import { Text } from '@radix-ui/themes';
import Link from 'next/link';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';

function filterSpaces(
  spaces: Space[],
  user: Person | undefined,
  web3SpaceIds: readonly bigint[] | undefined,
) {
  if (!user?.slug || !web3SpaceIds) {
    return spaces;
  }
  const userSpaces: Space[] = spaces.filter((space) => {
    const spaceId = space.web3SpaceId ? BigInt(space.web3SpaceId) : null;
    return spaceId !== null && web3SpaceIds.includes(spaceId);
  });
  return userSpaces;
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

  const filteredSpaces = React.useMemo(
    () => filterSpaces(spaces, user, web3SpaceIds),
    [spaces, user, web3SpaceIds],
  );

  return (
    <div className="space-y-6">
      <div className="justify-between items-center flex">
        <Text className="text-4">My Spaces | {filteredSpaces.length}</Text>
        <div className="flex items-center">
          <Link href={`/${lang}/my-spaces/create`} scroll={false}>
            <Button className="ml-2">
              <PlusIcon className="mr-2" />
              Create Space
            </Button>
          </Link>
        </div>
      </div>
      <SpaceCardList
        lang={lang}
        spaces={filteredSpaces}
        useMembers={useMembers}
      />
    </div>
  );
}
