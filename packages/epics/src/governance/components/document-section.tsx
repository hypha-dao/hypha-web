'use client';
import { FC } from 'react';
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
import { DocumentState, UseDocuments } from '..';
import { DocumentGridContainer } from './document-grid.container';

type DocumentSectionProps = {
  basePath: string;
  useDocuments: UseDocuments;
  documentState: DocumentState;
};

export const DocumentSection: FC<DocumentSectionProps> = ({
  basePath,
  useDocuments,
  documentState,
}) => {
  const {
    pages,
    activeFilter,
    setActiveFilter,
    isLoading,
    loadMore,
    pagination,
    sortOptions,
    tabs,
    activeTab,
    setActiveTab,
  } = useDocumentsSection({ useDocuments, documentState: documentState });

  return (
    <div className="flex flex-col justify-around items-center gap-4">
      <SectionFilter
        value={activeFilter}
        onChange={setActiveFilter}
        count={pagination?.total || 0}
        label={`${documentState}s`}
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
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={tabs || []}
        />
      )}
      {pagination?.totalPages === 0 ? (
        <Text className="text-neutral-11 mt-2 mb-6">List is empty</Text>
      ) : (
        <div className="space-y-2">
          {Array.from({ length: pages }).map((_, index) => (
            <DocumentGridContainer
              key={index}
              basePath={basePath}
              pagination={{
                page: index + 1,
                pageSize: 3,
                filter: { state: documentState },
              }}
              useDocuments={useDocuments}
              activeTab={activeTab}
            />
          ))}
        </div>
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
