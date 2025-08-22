'use client';

import {
  Empty,
  InnerSpaceCardContainer,
  UseMembers,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/server';
import { useSpaceCardList } from '../hooks/use-space-card-list';
import { SectionLoadMore } from '@hypha-platform/ui/server';
import { Text } from '@radix-ui/themes';

type InnerSpaceCardListProps = {
  lang: Locale;
  spaces: Space[];
  pageSize?: number;
  showLoadMore?: boolean;
  currentSpaceId: number;
  useMembers: UseMembers;
};

export function InnerSpaceCardList({
  lang,
  spaces,
  pageSize = 3,
  showLoadMore = true,
  currentSpaceId,
  useMembers,
}: InnerSpaceCardListProps) {
  const { pages, loadMore, pagination } = useSpaceCardList({
    spaces,
    pageSize,
  });

  return (
    <>
      {pagination?.totalPages > 0 ? (
        <div className="flex flex-col justify-around items-center gap-4 mb-4">
          <div className="w-full space-y-2">
            {showLoadMore ? (
              Array.from({ length: pages }).map((_, index) => {
                const startIndex = index * pageSize;
                const endIndex = startIndex + pageSize;
                const pageSpaces = spaces.slice(startIndex, endIndex);
                return (
                  <InnerSpaceCardContainer
                    key={index}
                    spaces={pageSpaces}
                    lang={lang}
                    useMembers={useMembers}
                    differentFirstCard={index === 0}
                    currentSpaceId={currentSpaceId}
                  />
                );
              })
            ) : (
              <InnerSpaceCardContainer
                key={`spaces-${spaces.length}`}
                spaces={spaces}
                lang={lang}
                useMembers={useMembers}
                differentFirstCard={true}
                currentSpaceId={currentSpaceId}
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
            <p>No spaces</p>
          </div>
        </Empty>
      )}
    </>
  );
}
