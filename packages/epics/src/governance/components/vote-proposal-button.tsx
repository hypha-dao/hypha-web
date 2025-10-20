import { Document, useMyVote } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';

export const VoteProposalButton = ({
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
