'use client';
import { FC } from 'react';
import { TransactionsList } from './transactions-list';
import { Text } from '@radix-ui/themes';
import { useUserTransfersSection } from '../../hooks';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';

type TransactionsSectionProps = {
  personSlug?: string;
};

export const UserTransactionsSection: FC<TransactionsSectionProps> = ({
  personSlug,
}) => {
  const {
    transfers,
    activeSort,
    isLoading,
    loadMore,
    hasMore,
    totalRequestsValue,
  } = useUserTransfersSection({ personSlug });

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
      <SectionLoadMore
        onClick={loadMore}
        disabled={!hasMore}
        isLoading={isLoading}
      >
        <Text>
          {hasMore ? 'Load more transactions' : 'No more transactions'}
        </Text>
      </SectionLoadMore>
    </div>
  );
};
