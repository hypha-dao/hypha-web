'use client';
import { FC } from 'react';
import { TransactionsList } from './transactions-list';
import { RefundableEscrowsList } from './refundable-escrows-list';
import { Text } from '@radix-ui/themes';
import { useUserTransfersSection } from '../../hooks';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from '../../../common';
import { useTranslations } from 'next-intl';
import { useMe } from '@hypha-platform/core/client';

type TransactionsSectionProps = {
  personSlug?: string;
  pageSize?: number;
};

export const UserTransactionsSection: FC<TransactionsSectionProps> = ({
  personSlug,
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
  } = useUserTransfersSection({ personSlug, pageSize });

  const { person } = useMe();
  const personAddress = person?.address as `0x${string}` | undefined;

  return (
    <div className="flex flex-col w-full items-center justify-center gap-3">
      <SectionFilter
        label={tTreasury('transactions')}
        hasSearch
        searchPlaceholder={tTreasury('searchTransactions')}
        onChangeSearch={setSearchTerm}
      />

      <RefundableEscrowsList user={personAddress} />

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
