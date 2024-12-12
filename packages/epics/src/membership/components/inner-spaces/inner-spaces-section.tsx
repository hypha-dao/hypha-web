'use client';
import { FC } from 'react';
import { InnerSpacesList } from './inner-spaces-list';
import { Text } from '@radix-ui/themes';
import { useInnerSpacesSection } from '../../hooks/use-inner-spaces-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';

type InnerSpacesSectionProps = Record<string, never>;

export const InnerSpacesSection: FC<InnerSpacesSectionProps> = () => {
  const {
    pages,
    activeSort,
    setSort,
    isLoading,
    loadMore,
    pagination,
    totalCount,
    filterOptions,
  } = useInnerSpacesSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeSort}
        onChange={setSort}
        count={totalCount}
        label="Inner Spaces"
        filterOptions={filterOptions}
      />
      {Array.from({ length: pages }).map((_, index) => (
        <InnerSpacesList page={index + 1} key={index} activeSort={activeSort} />
      ))}
      <SectionLoadMore
        onClick={loadMore}
        disabled={pagination?.totalPages === pages}
        isLoading={isLoading}
      >
        <Text>
          {pagination?.totalPages === pages
            ? 'No more inner spaces'
            : 'Load more inner spaces'}
        </Text>
      </SectionLoadMore>
    </div>
  );
};
