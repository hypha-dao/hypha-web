'use client';
import { FC } from 'react';
import { TransactionsList } from './transactions-list';
import { RefundableEscrowsList } from './refundable-escrows-list';
import { Text } from '@radix-ui/themes';
import { useTransfersSection } from '../../hooks/use-transfers-section';
import { SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from '../../../common';
import { useTranslations } from 'next-intl';
import {
  useSpaceBySlug,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { Input } from '@hypha-platform/ui';
import { SearchIcon } from 'lucide-react';

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

  const { space } = useSpaceBySlug(spaceSlug || '');
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: space?.web3SpaceId as number,
  });
  const executorAddress = spaceDetails?.executor as `0x${string}` | undefined;

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <div className="flex w-full justify-end">
        <Input
          className="w-full xl:w-[22rem]"
          placeholder={tTreasury('searchTransactions')}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <RefundableEscrowsList
        user={executorAddress}
        spaceId={space?.web3SpaceId as number | undefined}
        spaceDbId={space?.id as number | undefined}
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
