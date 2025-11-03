'use client';
import { FC } from 'react';
import { TransactionsList } from './transactions-list';
import { Text } from '@radix-ui/themes';
import { useTransfersSection } from '../../hooks/use-transfers-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';

type TransactionsSectionProps = {
  spaceSlug?: string;
};

export const TransactionsSection: FC<TransactionsSectionProps> = ({
  spaceSlug,
}) => {
  const {
    transfers,
    activeSort,
    isLoading,
    loadMore,
    hasMore,
    searchTerm,
    setSearchTerm,
  } = useTransfersSection({ spaceSlug: spaceSlug as string });

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

      {hasMore && transfers.length >= 4 && !searchTerm.trim() && (
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
