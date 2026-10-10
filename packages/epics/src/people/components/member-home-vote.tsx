'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useVote } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';

import { celebrate } from './member-home-celebrate';

type MemberHomeVoteProps = {
  proposalId: number;
  documentId: number;
};

export function MemberHomeVote({
  proposalId,
  documentId,
}: MemberHomeVoteProps) {
  const t = useTranslations('MemberHome');
  const { handleAccept, handleReject, isVoting } = useVote({
    proposalId,
    documentId,
  });
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);
  const [failed, setFailed] = useState(false);

  async function cast(next: 'yes' | 'no') {
    setFailed(false);
    celebrate();
    try {
      if (next === 'yes') await handleAccept();
      else await handleReject();
      setChoice(next);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        className="h-12 uppercase tracking-[0.12em]"
        disabled={isVoting || choice === 'yes'}
        onClick={() => {
          void cast('yes');
        }}
      >
        {t('voteYes')}
      </Button>
      <Button
        type="button"
        variant="outline"
        colorVariant="neutral"
        className="h-12 uppercase tracking-[0.12em]"
        disabled={isVoting || choice === 'no'}
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
