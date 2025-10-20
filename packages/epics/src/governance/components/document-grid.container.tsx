import { Order, Document } from '@hypha-platform/core/client';
import { DocumentGrid } from './document-grid';
import { Button } from '@hypha-platform/ui';

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
  showVoteButton?: boolean;
};

export const DocumentGridContainer = ({
  basePath,
  pagination,
  documents,
  showVoteButton = false,
}: DocumentGridContainerProps) => {
  const { page, firstPageSize, pageSize } = pagination;
  const startIndex = page <= 1 ? 0 : firstPageSize + (page - 2) * pageSize;
  const endIndex = Math.min(
    documents.length,
    page < 1 ? 0 : page === 1 ? firstPageSize : startIndex + pageSize,
  );
  const paginatedDocuments = documents.slice(startIndex, endIndex);

  return (
    <DocumentGrid
      documents={paginatedDocuments.map((doc) =>
        showVoteButton
          ? {
              ...doc,
              interactions: (
                <>
                  <Button
                    className="w-full"
                    variant="outline"
                    colorVariant="accent"
                  >
                    Vote Now
                  </Button>
                </>
              ),
            }
          : doc,
      )}
      isLoading={false}
      basePath={basePath}
    />
  );
};
