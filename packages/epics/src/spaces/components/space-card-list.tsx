'use client';

import { Empty, SpaceCardWrapper, UseMembers } from '@hypha-platform/epics';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@core/space';
import { Button } from '@hypha-platform/ui';
import { GlobeIcon, PlusIcon } from '@radix-ui/react-icons';

export function SpaceCardList({
  lang,
  spaces,
  useMembers,
}: {
  lang: Locale;
  spaces: Space[];
  useMembers: UseMembers;
}) {
  return (
    <>
      {spaces.length > 0 && (
        <div
          data-testid="member-spaces-container"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2"
        >
          {spaces.map((space) => (
            <div key={space.slug}>
              <Link href={`/${lang}/dho/${space.slug}/governance`}>
                <SpaceCardWrapper
                  description={space.description as string}
                  icon={space.logoUrl || ''}
                  leadImage={space.leadImage || ''}
                  agreements={space.documentCount}
                  title={space.title as string}
                  spaceSlug={space.slug as string}
                  useMembers={useMembers}
                />
              </Link>
            </div>
          ))}
        </div>
      )}

      {spaces.length === 0 && (
        <Empty>
          <div className="flex flex-col gap-7">
            <p>
              No spaces created or joined yet. Explore our network and join some
              Space, or create your own
            </p>
            <div className="flex gap-4 items-center justify-center">
              <Link href={`/${lang}/network`}>
                <Button variant="outline" className="gap-2">
                  <GlobeIcon />
                  Explore Spaces
                </Button>
              </Link>
              <Link href={`/${lang}/my-spaces/create`} scroll={false}>
                <Button className="gap-2">
                  <PlusIcon />
                  Create Space
                </Button>
              </Link>
            </div>
          </div>
        </Empty>
      )}
    </>
  );
}
