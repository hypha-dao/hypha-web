'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useJwt, useMyVote, useVote } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { useSpaceMember } from '../../spaces/hooks/use-space-member';
import type { HomeVoteItem } from '../home-activity';

export function HomeVotePanel({
  item,
  onVoted,
}: {
  item: HomeVoteItem;
  onVoted?: (vote: 'yes' | 'no') => void;
}) {
  const t = useTranslations('Journey');
  const { jwt } = useJwt();
  const { myVote, mutate } = useMyVote(item.proposalSlug);
  const { handleAccept, handleReject, isVoting } = useVote({
    documentId: item.documentId,
    proposalId: item.web3ProposalId,
    authToken: jwt,
  });
  const { isMember } = useSpaceMember({
    spaceId: item.web3SpaceId ?? undefined,
  });
  const [localVote, setLocalVote] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState(false);

  const vote = myVote ?? localVote;
  const canVote =
    Boolean(item.web3ProposalId) && Boolean(jwt) && isMember !== false;

  const cast = async (support: boolean) => {
    if (!canVote || isVoting || vote) return;
    setError(false);
    setLocalVote(support ? 'yes' : 'no');
    try {
      if (support) await handleAccept();
      else await handleReject();
      await mutate();
      onVoted?.(support ? 'yes' : 'no');
    } catch {
      setLocalVote(null);
      setError(true);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {item.description ? (
        <p className="max-w-[46ch] text-2 leading-relaxed text-muted-foreground">
          {item.description}
        </p>
      ) : null}
      {!jwt ? (
        <p className="text-2 text-muted-foreground">
          {t('usefulVoteNeedWallet')}
        </p>
      ) : isMember === false ? (
        <p className="text-2 text-muted-foreground">
          {t('usefulVoteNeedMember')}
        </p>
      ) : vote ? (
        <p className="text-2 font-medium">
          {vote === 'yes' ? t('usefulVotedYes') : t('usefulVotedNo')}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="rounded-xl"
            colorVariant="success"
            disabled={!canVote || isVoting}
            onClick={() => void cast(true)}
          >
            {t('usefulVoteYes')}
          </Button>
          <Button
            type="button"
            variant="outline"
            colorVariant="error"
            className="rounded-xl"
            disabled={!canVote || isVoting}
            onClick={() => void cast(false)}
          >
            {t('usefulVoteNo')}
          </Button>
        </div>
      )}
      {isVoting ? (
        <p className="text-1 text-muted-foreground">{t('usefulVoting')}</p>
      ) : null}
      {error ? (
        <p className="text-2 text-error-11">{t('usefulVoteError')}</p>
      ) : null}
    </div>
  );
}
