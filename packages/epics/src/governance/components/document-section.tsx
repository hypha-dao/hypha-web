'use client';
import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { useDocumentsSection } from '../hooks/use-documents-section';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';
import { Document } from '@hypha-platform/core/client';
import { DocumentGridContainer } from './document-grid.container';
import { DirectionType } from '@hypha-platform/core/client';
import { Empty } from '../../common';

type DocumentSectionProps = {
  basePath: string;
  documents: Document[];
  label?: string;
  headSectionButton?: React.ReactNode;
  hasSearch?: boolean;
  isLoading: boolean;
  firstPageSize?: number;
  pageSize?: number;
};

export const DocumentSection: FC<DocumentSectionProps> = ({
  basePath,
  documents,
  label,
  headSectionButton,
  hasSearch = false,
  isLoading,
  firstPageSize = 3,
  pageSize = 3,
}) => {
  const {
    pages,
    loadMore,
    pagination,
    onUpdateSearch,
    searchTerm,
    filteredDocuments,
  } = useDocumentsSection({
    documents,
    firstPageSize,
    pageSize,
  });

  return (
    <div className="flex flex-col justify-around items-center gap-4">
      <SectionFilter
        count={pagination?.total || 0}
        label={label || ''}
        hasSearch={hasSearch}
        searchPlaceholder="Search documents"
        onChangeSearch={onUpdateSearch}
      >
        {headSectionButton}
      </SectionFilter>

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>List is empty</p>
        </Empty>
      ) : (
        <div className="w-full space-y-2">
          {Array.from({ length: pages }).map((_, index) => (
            <DocumentGridContainer
              key={index}
              basePath={basePath}
              pagination={{
                page: index + 1,
                firstPageSize,
                pageSize,
                searchTerm,
                order: [
                  {
                    dir: DirectionType.DESC,
                    name: 'createdAt',
                  },
                ],
              }}
              documents={filteredDocuments}
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
