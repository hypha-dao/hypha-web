import { Card, Skeleton, Button } from '@hypha-platform/ui';
import { ProposalHead } from './proposal-head';
import { ProposalCardProps } from './proposal-card';
import { VoteButton } from './vote-button';

export const RowProposalView = ({
  commitment,
  status,
  title,
  creator,
  isLoading,
}: ProposalCardProps) => (
  <Card className="w-full h-full p-5 mb-2 flex items-center justify-between">
    <ProposalHead
      creator={creator}
      title={title}
      commitment={commitment}
      status={status}
      isLoading={isLoading}
    />
    <div>
      <Skeleton
        height="32px"
        width="86px"
        loading={isLoading}
        className="rounded-lg"
      >
        <VoteButton isLoading={isLoading} isVoted={false} />
      </Skeleton>
    </div>
  </Card>
);
