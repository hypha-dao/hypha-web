'use client';
import { FC } from 'react';
import { RequestsList } from './requests-list';
import { Text } from '@radix-ui/themes';
import { useRequestsSection } from '../../hooks/use-requests-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';

type RequestsSectionProps = Record<string, never>;

export const RequestsSection: FC<RequestsSectionProps> = () => {
  const {
    pages,
    activeSort,
    setSort,
    isLoading,
    loadMore,
    pagination,
    sortOptions,
    totalRequestsValue,
  } = useRequestsSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeSort}
        onChange={setSort}
        count={totalRequestsValue}
        label="Requests"
        sortOptions={sortOptions}
      >
        <Button className="ml-2">
          <PlusIcon className="mr-2" />
          Payout Request
        </Button>
      </SectionFilter>
      {pagination?.totalPages === 0 ? (
        <Text className="text-neutral-11 mt-2 mb-6">List is empty</Text>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <RequestsList page={index + 1} key={index} activeSort={activeSort} />
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
              ? 'No more requests'
              : 'Load more requests'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
