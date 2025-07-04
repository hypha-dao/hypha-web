'use client';
import { FC } from 'react';
import { TransactionsList } from './transactions-list';
import { Text } from '@radix-ui/themes';
import { useTransfersSection } from '../../hooks/use-transfers-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from '../../../common';

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
    totalRequestsValue,
  } = useTransfersSection({ spaceSlug: spaceSlug as string });

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter label="Transactions" />
      {transfers.length === 0 && !isLoading ? (
        <Text className="text-neutral-11 mt-2 mb-6">List is empty</Text>
      ) : (
        <TransactionsList
          transfers={transfers}
          activeSort={activeSort}
          isLoading={isLoading}
        />
      )}
      {hasMore && (
        <SectionLoadMore
          onClick={loadMore}
          disabled={!hasMore}
          isLoading={isLoading}
        >
          <Text>
            {hasMore ? 'Load more transactions' : 'No more transactions'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
