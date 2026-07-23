import {
  DocumentStatus,
  useIsDelegate,
  useMyVote,
  useProposalDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import React from 'react';
import { useTranslations } from 'next-intl';
import { useSpaceMember } from '../../spaces';
import { formatISO, isPast } from 'date-fns';

export const VoteProposalButton = ({
  documentSlug,
  web3ProposalId,
  web3SpaceId,
  proposalStatus,
  className,
}: {
  documentSlug?: string;
  web3ProposalId: number;
  web3SpaceId: number;
  proposalStatus?: DocumentStatus;
  className?: string;
}) => {
  const t = useTranslations('ProposalDetails.voteButton');
  const { myVote } = useMyVote(documentSlug);
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: web3ProposalId,
  });
  const { isMember } = useSpaceMember({
    spaceId: web3SpaceId,
  });
  const { isDelegate } = useIsDelegate({
    spaceId: web3SpaceId,
  });
  const output = React.useMemo(() => {
    const expired = proposalDetails?.expired;
    const executed = proposalDetails?.executed;
    const endTime = formatISO(new Date(proposalDetails?.endTime || new Date()));
    const needsDecision = isPast(new Date(endTime)) && !executed && !expired;
    if (!isMember && !isDelegate) {
      return null;
    }
    if (proposalStatus === 'onVoting' && needsDecision) {
      return (
        <Button className={className} variant="outline" colorVariant="accent">
          {t('confirmDecision')}
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
            {t('youVotedYes')}
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
            {t('youVotedNo')}
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
            {isSettled ? t('noVote') : t('voteNow')}
          </Button>
        );
    }
  }, [
    proposalStatus,
    myVote,
    proposalDetails,
    isMember,
    isDelegate,
    t,
    className,
  ]);
  return output;
};
