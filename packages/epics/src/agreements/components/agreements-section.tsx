'use client';

import { FC } from 'react';
import { AgreementsList } from './agreements-list';
import { Text } from '@radix-ui/themes';
import { useAgreements } from '../hooks/use-agreements';
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
    agreements,
    pagination,
    isLoading,
    activeFilter,
    setActiveFilter,
    pages,
    loadMore,
    sortOptions,
    filterOptions,
  } = useAgreements({
    page: 1,
    filter: 'all',
  });

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={pagination?.total || 0}
        label="Agreements"
        sortOptions={sortOptions}
      />
      <SectionTabs
        activeTab={activeFilter}
        setActiveTab={setActiveFilter}
        tabs={filterOptions}
      />

      <AgreementsList
        agreements={agreements}
        basePath={basePath}
        isLoading={isLoading}
      />

      <SectionLoadMore
        onClick={loadMore}
        disabled={pagination?.totalPages === pages || isLoading}
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
