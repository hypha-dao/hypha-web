import { Order, Document, useMyVote } from '@hypha-platform/core/client';
import { DocumentGrid } from './document-grid';
import { Button } from '@hypha-platform/ui';

const VoteProposalButton = ({
  document,
  className,
}: {
  document: Document;
  className?: string;
}) => {
  const { myVote } = useMyVote(document.slug);
  switch (myVote) {
    case 'yes':
      return (
        <Button className={className} variant="outline" colorVariant="success">
          You voted yes
        </Button>
      );
    case 'no':
      return (
        <Button className={className} variant="outline" colorVariant="error">
          You voted No
        </Button>
      );
    default:
      return (
        <Button className={className} variant="outline" colorVariant="accent">
          Vote Now
        </Button>
      );
  }
};

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
                <VoteProposalButton className="w-full" document={doc} />
              ),
            }
          : doc,
      )}
      isLoading={false}
      basePath={basePath}
    />
  );
};
