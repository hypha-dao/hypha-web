'use client';
import { FC } from 'react';
import { InnerSpacesList } from './inner-spaces-list';
import { Text } from '@radix-ui/themes';
import { useInnerSpacesSection } from '../../hooks/use-inner-spaces-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';

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
    sortOptions,
  } = useInnerSpacesSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeSort}
        onChange={setSort}
        count={totalCount}
        label="Inner Spaces"
        sortOptions={sortOptions}
      >
        <Button className="ml-2" size="sm">
          <PlusIcon className="mr-2" />
          Create
        </Button>
      </SectionFilter>
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
