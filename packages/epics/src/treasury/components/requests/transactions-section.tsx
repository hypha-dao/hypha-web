'use client';
import { FC } from 'react';
import { TransactionsList } from './transactions-list';
import { Text } from '@radix-ui/themes';
import { useTransfersSection } from '../../hooks/use-transfers-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from '../../../common';
import { useTranslations } from 'next-intl';

type TransactionsSectionProps = {
  spaceSlug?: string;
  pageSize?: number;
};

export const TransactionsSection: FC<TransactionsSectionProps> = ({
  spaceSlug,
  pageSize = 4,
}) => {
  const tTreasury = useTranslations('TreasuryTab');
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
        label={tTreasury('transactions')}
        hasSearch
        searchPlaceholder={tTreasury('searchTransactions')}
        onChangeSearch={setSearchTerm}
      />

      {transfers.length === 0 && !isLoading ? (
        <Empty>
          <p>{tTreasury('noTransactionsFound')}</p>
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
          <Text>{tTreasury('loadMoreTransactions')}</Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
