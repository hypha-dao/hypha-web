import { Order, Document } from '@hypha-platform/core/client';
import { DocumentGrid } from './document-grid';
import { VoteProposalButton } from './vote-proposal-button';
import { resolveInviteLeadImage } from '../utils/resolve-invite-lead-image';

type DocumentGridContainerProps = {
  basePath: string;
  web3SpaceId: number;
  /** Hosting space banner — used when Invite docs have no leadImage. */
  spaceLeadImage?: string | null;
  pagination: {
    page: number;
    firstPageSize: number;
    pageSize: number;
    searchTerm?: string;
    order?: Order<Document>;
  };
  documents: Document[];
  isLoading?: boolean;
};

export const DocumentGridContainer = ({
  basePath,
  web3SpaceId,
  spaceLeadImage,
  pagination,
  documents,
  isLoading = false,
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
        leadImage:
          resolveInviteLeadImage({
            leadImage: doc.leadImage,
            label: doc.label,
            title: doc.title,
            spaceLeadImage,
          }) ?? doc.leadImage,
        interactions:
          doc && doc.web3ProposalId ? (
            <VoteProposalButton
              className="flex w-full self-end"
              documentSlug={doc.slug}
              web3ProposalId={doc.web3ProposalId}
              web3SpaceId={web3SpaceId}
              proposalStatus={doc.status}
            />
          ) : null,
      }))}
      isLoading={isLoading}
      basePath={basePath}
    />
  );
};
