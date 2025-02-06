'use client';
import { FC } from 'react';
import { DiscussionsList } from './discussion-list';
import { Text } from '@radix-ui/themes';
import { useDiscussionsSection } from '../hooks/use-discussions-section';
import {
  SectionFilter,
  SectionLoadMore,
  SectionTabs,
} from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

type DiscussionSectionProps = {
  basePath: string;
};

export const DiscussionsSection: FC<DiscussionSectionProps> = ({
  basePath,
}) => {
  const {
    pages,
    activeFilter,
    setActiveFilter,
    isLoading,
    loadMore,
    pagination,
    sortOptions,
    filterOptions,
  } = useDiscussionsSection();

  return (
    <div className="flex flex-col justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={pagination?.total || 0}
        label="Discussions"
        sortOptions={sortOptions}
      >
        <Link href={`${basePath}/create`} scroll={false}>
          <Button className="ml-2">
            <PlusIcon className="mr-2" />
            Create
          </Button>
        </Link>
      </SectionFilter>
      {pagination?.totalPages === 0 ? null : (
        <SectionTabs
          activeTab={activeFilter}
          setActiveTab={setActiveFilter}
          tabs={filterOptions}
        />
      )}
      {pagination?.totalPages === 0 ? (
        <Text className="text-neutral-11 mt-2 mb-6">List is empty</Text>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <DiscussionsList
            page={index + 1}
            key={index}
            activeFilter={activeFilter}
            basePath={basePath}
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
              ? 'No more discussions'
              : 'Load more discussions'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
