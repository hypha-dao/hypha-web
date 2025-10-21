import { useMyVote } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';

export const VoteProposalButton = ({
  documentSlug,
  className,
}: {
  documentSlug?: string;
  className?: string;
}) => {
  const { myVote } = useMyVote(documentSlug);
  switch (myVote) {
    case 'yes':
      return (
        <Button className={className} variant="outline" colorVariant="success">
          You Voted Yes
        </Button>
      );
    case 'no':
      return (
        <Button className={className} variant="outline" colorVariant="error">
          You Voted No
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
