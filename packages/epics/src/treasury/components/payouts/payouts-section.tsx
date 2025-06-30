'use client';
import { FC } from 'react';
import { PayoutsList } from './payouts-list';
import { Text } from '@radix-ui/themes';
import { usePayoutsSection } from '../../hooks/use-payouts-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Empty } from "packages/epics/src/common";

type PayoutSectionProps = Record<string, never>;

export const PayoutsSection: FC<PayoutSectionProps> = () => {
  const { pages, activeFilter, isLoading, loadMore, pagination, totalValue } =
    usePayoutsSection();

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter count={totalValue || 0} label="Payouts" />
      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <PayoutsList
            page={index + 1}
            key={index}
            activeFilter={activeFilter}
          />
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
              ? 'No more payouts'
              : 'Load more payouts'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
