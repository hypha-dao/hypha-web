'use client';
import { FC } from 'react';
import { DocumentGrid } from './document-grid';
import { Text } from '@radix-ui/themes';
import { useDocumentsSection } from '../hooks/use-documents-section';
import {
  SectionFilter,
  SectionLoadMore,
  SectionTabs,
} from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { UseDocuments } from '..';

type DocumentSectionProps = {
  basePath: string;
  useDocuments: UseDocuments;
  state: 'agreements' | 'proposals' | 'discussions';
};

export const DocumentSection: FC<DocumentSectionProps> = ({
  basePath,
  useDocuments,
  state,
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
    documents,
  } = useDocumentsSection({ useDocuments, filterOptionsType: state });

  return (
    <div className="flex flex-col justify-center items-center">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={pagination?.total || 0}
        label={state}
        sortOptions={sortOptions}
      >
        <Link href={`${basePath}/create`} scroll={false}>
          <Button className="ml-2">
            <PlusIcon className="mr-2" />
            Create
          </Button>
        </Link>
      </SectionFilter>
      {pagination?.totalPages === 0 ? null : (
        <SectionTabs
          activeTab={activeFilter}
          setActiveTab={setActiveFilter}
          tabs={filterOptions || []}
        />
      )}
      {pagination?.totalPages === 0 ? (
        <Text className="text-neutral-11 mt-2 mb-6">List is empty</Text>
      ) : (
        <DocumentGrid
          basePath={basePath}
          isLoading={isLoading}
          documents={documents}
        />
      )}
      {pagination?.totalPages === 0 ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={pagination?.totalPages === pages}
          isLoading={isLoading}
        >
          <Text>
            {pagination?.totalPages === pages ? 'No more' : 'Load more'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
