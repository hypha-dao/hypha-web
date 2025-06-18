'use client';
import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { useDocumentsSection } from '../hooks/use-documents-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Document } from '@core/governance';
import { DocumentGridContainer } from './document-grid.container';

type DocumentSectionProps = {
  basePath: string;
  documents: Document[];
  label?: string;
  headSectionButton?: React.ReactNode;
  hasSearch?: boolean;
  isLoading: boolean;
};

export const DocumentSection: FC<DocumentSectionProps> = ({
  basePath,
  documents,
  label,
  headSectionButton,
  hasSearch = false,
  isLoading,
}) => {
  const { pages, loadMore, pagination, activeTab, onUpdateSearch, searchTerm } =
    useDocumentsSection({
      documents,
    });

  return (
    <div className="flex flex-col justify-around items-center gap-4">
      <SectionFilter
        count={pagination?.total || 0}
        label={label || ''}
        hasSearch={hasSearch}
        onChangeSearch={onUpdateSearch}
      >
        {headSectionButton}
      </SectionFilter>

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
                searchTerm,
              }}
              documents={documents}
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
