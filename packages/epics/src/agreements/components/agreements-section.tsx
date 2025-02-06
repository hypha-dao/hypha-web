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

type AgreementsSectionProps = {
  basePath: string;
};

export const AgreementsSection: FC<AgreementsSectionProps> = ({ basePath }) => {
  const {
    pages,
    activeFilter,
    setActiveFilter,
    isLoading,
    loadMore,
    pagination,
    sortOptions,
    filterOptions,
  } = useAgreementsSection();

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={pagination?.total || 0}
        label="Agreements"
        sortOptions={sortOptions}
      />
      {pagination?.totalPages === 0 ? null : <SectionTabs
        activeTab={activeFilter}
        setActiveTab={setActiveFilter}
        tabs={filterOptions}
      />}
      {pagination?.totalPages === 0 ? <Text className='text-neutral-11 mt-2 mb-6'>List is empty</Text> : Array.from({ length: pages }).map((_, index) => (
        <AgreementsList
          page={index + 1}
          key={index}
          activeFilter={activeFilter}
          basePath={basePath}
        />
      ))}
      {pagination?.totalPages === 0 ? null : <SectionLoadMore
        onClick={loadMore}
        disabled={pagination?.totalPages === pages}
        isLoading={isLoading}
      >
        <Text>
          {pagination?.totalPages === pages
            ? 'No more agreements'
            : 'Load more agreements'}
        </Text>
      </SectionLoadMore>}
    </div>
  );
};
