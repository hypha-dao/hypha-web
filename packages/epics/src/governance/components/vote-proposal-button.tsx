import {
  useMyVote,
  useProposalDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import React from 'react';

export const VoteProposalButton = ({
  proposalId,
  documentSlug,
  className,
}: {
  proposalId?: number | null | undefined;
  documentSlug?: string;
  className?: string;
}) => {
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: proposalId as number,
  });
  const { myVote } = useMyVote(documentSlug);
  const output = React.useMemo(() => {
    console.log('My vote:', myVote);
    console.log('Proposal details:', proposalDetails);
    const expired = proposalDetails?.expired;
    const executed = proposalDetails?.executed;
    if (expired && !executed) {
      return (
        <Button
          className={className}
          variant="outline"
          colorVariant="accent"
          disabled={expired || executed}
        >
          Confirm Outcome
        </Button>
      );
    }
    switch (myVote) {
      case 'yes':
        return (
          <Button
            className={className}
            variant="outline"
            colorVariant="success"
            disabled={expired || executed}
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
            disabled={expired || executed}
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
            disabled={expired || executed}
          >
            {expired || executed ? 'No Vote' : 'Vote Now'}
          </Button>
        );
    }
  }, [proposalDetails, myVote]);
  return output;
};
