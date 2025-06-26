'use client';
import { FC } from 'react';
import { ProposalList } from './proposal-list';
import { Text } from '@radix-ui/themes';
import { useProposalsSection } from '../hooks';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';
import { UseDocuments } from '../../governance';
import { Empty } from "../../common";

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
    filterOptions,
  } = useProposalsSection({ useDocuments });

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <SectionFilter count={pagination?.total || 0} label="Proposals">
        <Button className="ml-2">
          <PlusIcon className="mr-2" />
          Create
        </Button>
      </SectionFilter>

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
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
