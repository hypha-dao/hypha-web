'use client';
import { FC } from 'react';
import { PayoutsList } from './payouts-list';
import { Text } from '@radix-ui/themes';
import { usePayoutsSection } from '../../hooks/use-payouts-section';
import {
  SectionFilter,
  SectionLoadMore,
  SectionTabs,
} from '@hypha-platform/ui/server';

type PayoutSectionProps = Record<string, never>;

export const PayoutsSection: FC<PayoutSectionProps> = () => {
  const {
    pages,
    activeFilter,
    setActiveFilter,
    isLoading,
    loadMore,
    pagination,
    sortOptions,
    filterOptions,
    totalValue,
  } = usePayoutsSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={totalValue || 0}
        label="Payouts"
        sortOptions={sortOptions}
      />
      <SectionTabs
        activeTab={activeFilter}
        setActiveTab={setActiveFilter}
        tabs={filterOptions}
      />
      {Array.from({ length: pages }).map((_, index) => (
        <PayoutsList page={index + 1} key={index} activeFilter={activeFilter} />
      ))}
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
    </div>
  );
};