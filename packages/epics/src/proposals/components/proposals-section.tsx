'use client';
import { FC } from 'react';
import { ProposalList } from './proposal-list';
import { Text } from '@radix-ui/themes';
import { useProposalsSection } from '../hooks/use-proposals-section';
import {
  SectionFilter,
  SectionLoadMore,
  SectionTabs,
} from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';
import { UseDocuments } from '../../governance';

type ProposalSectionProps = {
  basePath: string;
  useDocuments: UseDocuments;
};

export const ProposalsSection: FC<ProposalSectionProps> = ({
  basePath,
  useDocuments,
}) => {
  const {
    pages,
    activeFilter,
    setActiveFilter,
    isLoading,
    loadMore,
    pagination,
    sortOptions,
    filterOptions,
  } = useProposalsSection({ useDocuments });

  return (
    <div className="flex flex-col w-full justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={pagination?.total || 0}
        label="Proposals"
        sortOptions={sortOptions}
      >
        <Button className="ml-2">
          <PlusIcon className="mr-2" />
          Create
        </Button>
      </SectionFilter>
      {pagination?.totalPages === 0 ? null : (
        <SectionTabs
          activeTab={activeFilter}
          setActiveTab={setActiveFilter}
          tabs={filterOptions}
        />
      )}
      {pagination?.totalPages === 0 ? (
        <Text className="text-neutral-11 mt-2 mb-6">List is empty</Text>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <ProposalList
            basePath={basePath}
            page={index + 1}
            key={index}
            useDocuments={useDocuments}
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
              ? 'No more proposals'
              : 'Load more proposals'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
