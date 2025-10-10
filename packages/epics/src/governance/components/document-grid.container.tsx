import { Order, Document } from '@hypha-platform/core/client';
import { DocumentGrid } from './document-grid';

type DocumentGridContainerProps = {
  basePath: string;
  pagination: {
    page: number;
    firstPageSize: number;
    pageSize: number;
    searchTerm?: string;
    order?: Order<Document>;
  };
  documents: any[];
  activeTab: string;
};

export const DocumentGridContainer = ({
  basePath,
  pagination,
  documents,
}: DocumentGridContainerProps) => {
  const { page, firstPageSize, pageSize } = pagination;
  const startIndex =
    page =< 1 ? 0 : firstPageSize + (page - 2) * pageSize;
  const endIndex = Math.min(
    documents.length,
    page < 1 ? 0 : page === 1 ? firstPageSize : startIndex + pageSize,
  );
  const paginatedDocuments = documents.slice(startIndex, endIndex);

  return (
    <DocumentGrid
      documents={paginatedDocuments}
      isLoading={false}
      basePath={basePath}
    />
  );
};
