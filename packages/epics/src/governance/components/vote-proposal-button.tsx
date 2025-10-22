import { DocumentStatus, useMyVote } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import React from 'react';

export const VoteProposalButton = ({
  documentSlug,
  proposalStatus,
  className,
}: {
  documentSlug?: string;
  proposalStatus?: DocumentStatus;
  className?: string;
}) => {
  const { myVote } = useMyVote(documentSlug);
  const output = React.useMemo(() => {
    if (proposalStatus === 'onVoting' && myVote === null) {
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
  }, [proposalStatus, myVote]);
  return output;
};
