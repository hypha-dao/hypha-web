import { GridProposalView } from './grid-proposal-view';
import { RowProposalView } from './row-proposal-view';
import { CreatorType } from './proposal-head';

export type ProposalCardProps = {
  creator?: CreatorType;
  title?: string;
  commitment?: number;
  status?: string;
  isLoading?: boolean;
  leadImage?: string;
  description?: string;
  gridView?: boolean;
};

export const ProposalCard = ({
  commitment,
  status,
  title,
  creator,
  isLoading,
  leadImage,
  description,
  gridView,
}: ProposalCardProps) => {
  return gridView ? (
    <GridProposalView
      commitment={commitment}
      status={status}
      title={title}
      creator={creator}
      isLoading={isLoading}
      leadImage={leadImage}
      description={description}
    />
  ) : (
    <RowProposalView
      commitment={commitment}
      status={status}
      title={title}
      creator={creator}
      isLoading={isLoading}
    />
  );
};
