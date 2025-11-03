'use client';
import { FC } from 'react';
import { TransactionsList } from './transactions-list';
import { Text } from '@radix-ui/themes';
import { useTransfersSection } from '../../hooks/use-transfers-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';

type TransactionsSectionProps = {
  spaceSlug?: string;
  pageSize?: number;
};

export const TransactionsSection: FC<TransactionsSectionProps> = ({
  spaceSlug,
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
  } = useTransfersSection({ spaceSlug: spaceSlug as string, pageSize });

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter
        label="Transactions"
        hasSearch
        searchPlaceholder="Search transactions"
        onChangeSearch={setSearchTerm}
      />

      {transfers.length === 0 && !isLoading ? (
        <Text className="text-neutral-11 mt-2 mb-6">No transactions found</Text>
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
