'use client';
import { FC } from 'react';
import { OuterSpacesList } from './outer-spaces-list';
import { Text } from '@radix-ui/themes';
import { useSpacesSection } from '../hooks';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';

type OuterSpacesSectionProps = Record<string, never>;

export const OuterSpacesSection: FC<OuterSpacesSectionProps> = () => {
  const {
    pages,
    activeSort,
    setSort,
    isLoading,
    loadMore,
    pagination,
    totalCount,
  } = useSpacesSection();

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter count={totalCount} label="Outer Spaces">
        <Button className="ml-2">
          <PlusIcon className="mr-2" />
          Invite space
        </Button>
      </SectionFilter>
      {pagination?.totalPages === 0 ? (
        <Text className="text-neutral-11 mt-2 mb-6">List is empty</Text>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <OuterSpacesList
            page={index + 1}
            key={index}
            activeSort={activeSort}
          />
        ))
      )}
      {pagination?.totalPages === 0 ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={pagination?.totalPages === pages}
          isLoading={isLoading}
        >
          <Text>
            {pagination?.totalPages === pages
              ? 'No more outer spaces'
              : 'Load more outer spaces'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
