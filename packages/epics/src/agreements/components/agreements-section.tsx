'use client';
import { FC } from 'react';
import { AgreementsList } from './agreements-list';
import { Text } from '@radix-ui/themes';
import { useAgreementsSection } from '../hooks/use-agreements-section';
import {
  SectionFilter,
  SectionLoadMore,
  SectionTabs,
} from '@hypha-platform/ui/server';

type AgreementsSectionProps = Record<string, never>;

export const AgreementsSection: FC<AgreementsSectionProps> = () => {
  const {
    pages,
    activeFilter,
    setActiveFilter,
    isLoading,
    loadMore,
    pagination,
    filterOptions,
    tabs,
  } = useAgreementsSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={pagination?.total || 0}
        label="Agreements"
        filterOptions={filterOptions}
      />
      <SectionTabs
        activeTab={activeFilter}
        setActiveTab={setActiveFilter}
        tabs={tabs}
      />
      {Array.from({ length: pages }).map((_, index) => (
        <AgreementsList
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
            ? 'No more agreements'
            : 'Load more agreements'}
        </Text>
      </SectionLoadMore>
    </div>
  );
};
