'use client';
import { FC } from 'react';
import { ProposalList } from './proposal-list';
import { Text } from '@radix-ui/themes';
import { useProposalsSection } from '../hooks/use-proposals-section';
import { SectionFilter, SectionLoadMore, SectionTabs } from '@hypha-platform/ui/server';

type ProposalSectionProps = Record<string, never>;

export const ProposalsSection: FC<ProposalSectionProps> = () => {
  const {
    pages,
    activeFilter,
    setActiveFilter,
    isLoading,
    loadMore,
    pagination,
    filterOptions,
    tabs
  } = useProposalsSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={pagination?.total || 0}
        label='Proposals'
        filterOptions={filterOptions}
      />
      <SectionTabs activeTab={activeFilter} setActiveTab={setActiveFilter} tabs={tabs}/>
      {Array.from({ length: pages }).map((_, index) => (
        <ProposalList
          page={index + 1}
          key={index}
          activeFilter={activeFilter}
        />
      ))}
      <SectionLoadMore
        onClick={loadMore}
        disabled={pagination?.totalPages === pages}
        isLoading={isLoading}
      >
        <Text>
          {pagination?.totalPages === pages
            ? 'No more proposals'
            : 'Load more proposals'}
        </Text>
      </SectionLoadMore>
    </div>
  );
};
