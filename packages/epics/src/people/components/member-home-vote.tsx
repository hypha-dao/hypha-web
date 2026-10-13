'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useJwt, useMyVote, useVote } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { celebrate } from './member-home-celebrate';
import { markHomeActed } from './member-home-resume';

type MemberHomeVoteProps = {
  proposalId: number;
  documentId: number;
  documentSlug: string;
  tokenSymbol?: string | null;
  /** Same window as the proposal screen: not executed, not expired, end still ahead. */
  open: boolean;
};

export function MemberHomeVote({
  proposalId,
  documentId,
  documentSlug,
  tokenSymbol,
  open,
}: MemberHomeVoteProps) {
  const t = useTranslations('MemberHome');
  const { jwt: authToken } = useJwt();
  const { handleAccept, handleReject, isVoting } = useVote({
    proposalId,
    documentId,
    authToken,
    tokenSymbol,
  });
  const { myVote, isLoading: voteRecordLoading } = useMyVote(documentSlug);
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);
  const [failed, setFailed] = useState(false);
  const recorded =
    choice ?? (myVote === 'yes' || myVote === 'no' ? myVote : null);

  if (!choice && voteRecordLoading) return null;

  if (!open || (recorded && !choice)) {
    if (!recorded) return null;
    return (
      <p className="text-1 text-neutral-11">
        {recorded === 'yes' ? t('votedYes') : t('votedNo')}
      </p>
    );
  }

  async function cast(next: 'yes' | 'no') {
    if (!open || choice) return;
    celebrate();
    setFailed(false);
    try {
      if (next === 'yes') await handleAccept();
      else await handleReject();
      setChoice(next);
      markHomeActed(`proposal:${documentSlug}`);
    } catch (error) {
      console.error('Vote failed', error);
      setFailed(true);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant={choice === 'no' ? 'outline' : 'default'}
        colorVariant={choice === 'no' ? 'neutral' : 'accent'}
        className={cn(
          'h-12 uppercase tracking-[0.12em]',
          choice === 'yes' && 'ring-1 ring-foreground',
        )}
        disabled={isVoting || (choice != null && choice !== 'yes')}
        onClick={() => {
          void cast('yes');
        }}
      >
        {t('voteYes')}
      </Button>
      <Button
        type="button"
        variant={choice === 'no' ? 'default' : 'outline'}
        colorVariant={choice === 'no' ? 'accent' : 'neutral'}
        className={cn(
          'h-12 uppercase tracking-[0.12em]',
          choice === 'no' && 'ring-1 ring-foreground',
        )}
        disabled={isVoting || (choice != null && choice !== 'no')}
        onClick={() => {
          void cast('no');
        }}
      >
        {t('voteNo')}
      </Button>
      {choice ? (
        <p className="col-span-2 text-1 text-neutral-11">
          {choice === 'yes' ? t('votedYes') : t('votedNo')}
        </p>
      ) : null}
      {failed ? (
        <p className="col-span-2 text-1 text-error-11" role="alert">
          {t('voteFailed')}
        </p>
      ) : null}
    </div>
  );
}
