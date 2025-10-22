import { Order, Document } from '@hypha-platform/core/client';
import { DocumentGrid } from './document-grid';
import { VoteProposalButton } from './vote-proposal-button';

type DocumentGridContainerProps = {
  basePath: string;
  web3SpaceId: number;
  pagination: {
    page: number;
    firstPageSize: number;
    pageSize: number;
    searchTerm?: string;
    order?: Order<Document>;
  };
  documents: Document[];
};

export const DocumentGridContainer = ({
  basePath,
  web3SpaceId,
  pagination,
  documents,
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
      documents={paginatedDocuments.map((doc) => ({
        ...doc,
        interactions: (
          <VoteProposalButton
            className="flex w-full self-end"
            documentSlug={doc?.slug}
            web3ProposalId={doc?.web3ProposalId}
            web3SpaceId={web3SpaceId}
            proposalStatus={doc?.status}
          />
        ),
      }))}
      isLoading={false}
      basePath={basePath}
    />
  );
};
