'use client';

import { Empty, UseMembers, SpaceCardContainer } from '@hypha-platform/epics';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@core/space';
import { Button } from '@hypha-platform/ui';
import { GlobeIcon, PlusIcon } from '@radix-ui/react-icons';
import { useSpaceCardList } from '../hooks/use-space-card-list';
import { SectionLoadMore } from '@hypha-platform/ui/server';
import { Text } from '@radix-ui/themes';

type SpaceCardListProps = {
  lang: Locale;
  spaces: Space[];
  pageSize?: number;
  useMembers: UseMembers;
};

export function SpaceCardList({
  lang,
  spaces,
  pageSize = 2,
  useMembers,
}: SpaceCardListProps) {
  const { pages, loadMore, pagination } = useSpaceCardList({
    spaces,
    pageSize,
  });

  return (
    <>
      {pagination?.totalPages > 0 ? (
        <div className="flex flex-col justify-around items-center gap-4">
          <div className="w-full space-y-2">
            {Array.from({ length: pages }).map((_, index) => {
              const startIndex = index * pageSize;
              const endIndex = startIndex + pageSize;
              const pageSpaces = spaces.slice(startIndex, endIndex);
              return (
                <SpaceCardContainer
                  key={index}
                  spaces={pageSpaces}
                  lang={lang}
                  useMembers={useMembers}
                />
              );
            })}
          </div>
          <SectionLoadMore
            onClick={loadMore}
            disabled={!pagination?.hasNextPage}
          >
            <Text>{pagination?.hasNextPage ? 'Load more' : 'No more'}</Text>
          </SectionLoadMore>
        </div>
      ) : (
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
