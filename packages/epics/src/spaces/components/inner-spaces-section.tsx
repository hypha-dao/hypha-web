'use client';
import { FC } from 'react';
import { InnerSpacesList } from './inner-spaces-list';
import { Text } from '@radix-ui/themes';
import { useSpacesSection } from '../hooks';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';

type InnerSpacesSectionProps = {
  basePath: string;
};

export const InnerSpacesSection: FC<InnerSpacesSectionProps> = ({
  basePath,
}) => {
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
      <SectionFilter count={totalCount} label="Inner Spaces">
        <Button className="ml-2">
          <PlusIcon className="mr-2" />
          Create
        </Button>
      </SectionFilter>
      {pagination?.totalPages === 0 ? (
        <Text className="text-neutral-11 mt-2 mb-6">List is empty</Text>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <InnerSpacesList
            basePath={basePath}
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
              ? 'No more inner spaces'
              : 'Load more inner spaces'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
