import { Order, Document } from '@hypha-platform/core/client';
import { DocumentGrid } from './document-grid';

type DocumentGridContainerProps = {
  basePath: string;
  pagination: {
    page: number;
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
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const endIndex = startIndex + pagination.pageSize;
  const paginatedDocuments = documents.slice(startIndex, endIndex);

  return (
    <DocumentGrid
      documents={paginatedDocuments}
      isLoading={false}
      basePath={basePath}
    />
  );
};
