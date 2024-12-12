'use client';
import { FC } from 'react';
import { OuterSpacesList } from './outer-spaces-list';
import { Text } from '@radix-ui/themes';
import { useOuterSpacesSection } from '../../hooks/use-outer-spaces-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';

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
    filterOptions,
  } = useOuterSpacesSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeSort}
        onChange={setSort}
        count={totalCount}
        label="Outer Spaces"
        filterOptions={filterOptions}
      />
      {Array.from({ length: pages }).map((_, index) => (
        <OuterSpacesList page={index + 1} key={index} activeSort={activeSort} />
      ))}
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
    </div>
  );
};
