import {
  DocumentStatus,
  useMyVote,
  useProposalDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import React from 'react';
import { useJoinSpace } from '../../spaces';

export const VoteProposalButton = ({
  documentSlug,
  web3ProposalId,
  web3SpaceId,
  proposalStatus,
  className,
}: {
  documentSlug?: string;
  web3ProposalId?: number | null;
  web3SpaceId: number;
  proposalStatus?: DocumentStatus;
  className?: string;
}) => {
  const { myVote } = useMyVote(documentSlug);
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: web3ProposalId as number,
  });
  const { isMember } = useJoinSpace({
    spaceId: web3SpaceId,
  });
  const output = React.useMemo(() => {
    if (!isMember) {
      return <></>;
    }
    if (proposalStatus === 'onVoting' && proposalDetails?.expired) {
      return (
        <Button className={className} variant="outline" colorVariant="accent">
          Confirm Outcome
        </Button>
      );
    }
    const isSettled =
      proposalStatus === 'accepted' || proposalStatus === 'rejected';
    switch (myVote) {
      case 'yes':
        return (
          <Button
            className={className}
            variant="outline"
            colorVariant="success"
            disabled={isSettled}
          >
            You Voted Yes
          </Button>
        );
      case 'no':
        return (
          <Button
            className={className}
            variant="outline"
            colorVariant="error"
            disabled={isSettled}
          >
            You Voted No
          </Button>
        );
      default:
        return (
          <Button
            className={className}
            variant="outline"
            colorVariant="accent"
            disabled={isSettled}
          >
            {isSettled ? 'No Vote' : 'Vote Now'}
          </Button>
        );
    }
  }, [proposalStatus, myVote, proposalDetails, isMember]);
  return output;
};
