'use client';
import { FC } from 'react';
import { TransactionsList } from './transactions-list';
import { Text } from '@radix-ui/themes';
import { useUserTransfersSection } from '../../hooks';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from '../../../common';

type TransactionsSectionProps = {
  personSlug?: string;
  pageSize?: number;
};

export const UserTransactionsSection: FC<TransactionsSectionProps> = ({
  personSlug,
  pageSize = 4,
}) => {
  const {
    transfers,
    activeSort,
    isLoading,
    loadMore,
    hasMore,
    searchTerm,
    setSearchTerm,
    pageSize: usedPageSize,
  } = useUserTransfersSection({ personSlug, pageSize });

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter
        label="Transactions"
        hasSearch
        searchPlaceholder="Search transactions"
        onChangeSearch={setSearchTerm}
      />

      {transfers.length === 0 && !isLoading ? (
        <Empty>
          <p>No transactions found</p>
        </Empty>
      ) : (
        <TransactionsList
          transfers={transfers}
          activeSort={activeSort}
          isLoading={isLoading}
        />
      )}

      {hasMore && transfers.length >= usedPageSize && !searchTerm.trim() && (
        <SectionLoadMore
          onClick={loadMore}
          disabled={!hasMore}
          isLoading={isLoading}
        >
          <Text>Load more transactions</Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
