'use client';

import { Empty, SpaceCardContainer } from '@hypha-platform/epics';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/server';
import { Button } from '@hypha-platform/ui';
import { GlobeIcon, PlusIcon } from '@radix-ui/react-icons';
import { useSpaceCardList } from '../hooks/use-space-card-list';
import { SectionLoadMore } from '@hypha-platform/ui/server';
import { Text } from '@radix-ui/themes';
import { useAuthentication } from '@hypha-platform/authentication';

type SpaceCardListProps = {
  lang: Locale;
  spaces: Space[];
  pageSize?: number;
  showLoadMore?: boolean;
  showExitButton?: boolean;
};

export function SpaceCardList({
  lang,
  spaces,
  pageSize = 3,
  showLoadMore = true,
  showExitButton = false,
}: SpaceCardListProps) {
  const { pages, loadMore, pagination } = useSpaceCardList({
    spaces,
    pageSize,
  });
  const { isAuthenticated } = useAuthentication();

  return (
    <>
      {pagination?.totalPages > 0 ? (
        <div className="flex flex-col justify-around items-center gap-4">
          <div className="w-full space-y-2">
            {showLoadMore ? (
              Array.from({ length: pages }).map((_, index) => {
                const startIndex = index * pageSize;
                const endIndex = startIndex + pageSize;
                const pageSpaces = spaces.slice(startIndex, endIndex);
                return (
                  <SpaceCardContainer
                    key={index}
                    spaces={pageSpaces}
                    lang={lang}
                    showExitButton={showExitButton}
                  />
                );
              })
            ) : (
              <SpaceCardContainer
                key={`spaces-${spaces.length}`}
                spaces={spaces}
                lang={lang}
                showExitButton={showExitButton}
              />
            )}
          </div>
          {showLoadMore && (
            <SectionLoadMore
              onClick={loadMore}
              disabled={!pagination?.hasNextPage}
            >
              <Text>{pagination?.hasNextPage ? 'Load more' : 'No more'}</Text>
            </SectionLoadMore>
          )}
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
              <Link
                className={!isAuthenticated ? 'cursor-not-allowed' : ''}
                title={
                  !isAuthenticated ? 'Please sign in to use this feature.' : ''
                }
                href={isAuthenticated ? `/${lang}/my-spaces/create` : {}}
                scroll={false}
              >
                <Button disabled={!isAuthenticated} className="gap-2">
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
