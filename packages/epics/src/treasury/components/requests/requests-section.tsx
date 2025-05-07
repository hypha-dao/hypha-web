'use client';
import { FC } from 'react';
import { RequestsList } from './requests-list';
import { Text } from '@radix-ui/themes';
import { useRequestsSection } from '../../hooks/use-requests-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';

type RequestsSectionProps = Record<string, never>;

export const RequestsSection: FC<RequestsSectionProps> = () => {
  const {
    pages,
    activeSort,
    setSort,
    isLoading,
    loadMore,
    pagination,
    totalRequestsValue,
  } = useRequestsSection();

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter count={totalRequestsValue} label="Requests" />
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
