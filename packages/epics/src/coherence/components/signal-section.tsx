'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { Coherence } from '../types';
import { useSignalsSection } from '../hooks';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui';
import { Empty } from '../../common';
import { SignalGridContainer } from './signal-grid.container';
import { DirectionType } from '@hypha-platform/core/client';

type SignalSectionProps = {
  signals: Coherence[];
  label?: string;
  hasSearch?: boolean;
  isLoading: boolean;
  firstPageSize?: number;
  pageSize?: number;
};

export const SignalSection: FC<SignalSectionProps> = ({
  signals,
  label,
  hasSearch = false,
  isLoading,
  firstPageSize = 3,
  pageSize = 3,
}) => {
  const {
    pages,
    loadMore,
    pagination,
    onUpdateSearch,
    searchTerm,
    filteredSignals,
  } = useSignalsSection({
    signals,
    firstPageSize,
    pageSize,
  });

  return (
    <div className="flex flex-col justify-around items-center gap-4">
      <SectionFilter
        count={pagination?.total || 0}
        label={label || ''}
        hasSearch={hasSearch}
        searchPlaceholder="Search documents"
        onChangeSearch={onUpdateSearch}
        inlineLabel={true}
      ></SectionFilter>

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
      ) : (
        <div className="w-full space-y-2">
          {Array.from({ length: pages }).map((_, index) => (
            <SignalGridContainer
              key={index}
              pagination={{
                page: index + 1,
                firstPageSize,
                pageSize,
                searchTerm,
                order: [
                  {
                    dir: DirectionType.DESC,
                    name: 'id',
                  },
                ],
              }}
              signals={filteredSignals}
            />
          ))}
        </div>
      )}
      {pagination?.totalPages === 0 ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={pagination?.totalPages === pages}
          isLoading={isLoading}
        >
          <Text>
            {pagination?.totalPages === pages ? 'No more' : 'Load more'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
