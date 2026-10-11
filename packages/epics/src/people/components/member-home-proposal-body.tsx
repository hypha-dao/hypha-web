'use client';

import { intervalToDuration, isPast } from 'date-fns';
import { useTranslations } from 'next-intl';
import { formatUnits } from 'viem';
import {
  TOKENS,
  useProposalDetailsWeb3Rpc,
  useProposalVoters,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';

import { ProgressLine } from '../../proposals/components/progress-line';
import { PersonAvatar } from './person-avatar';
import { MemberHomeVote } from './member-home-vote';

type MemberHomeProposalBodyProps = {
  proposalId: number | null;
  spaceId: number | null;
  documentId: number | null;
  documentSlug: string;
};

function tokenDecimals(address: string) {
  const normalized = address.toLowerCase();
  if (
    normalized === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' ||
    normalized === '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42' ||
    normalized === '0x449b3317a6d1efb1bc3ba0700c9eaa4ffff4ae65'
  ) {
    return 6;
  }
  if (normalized === '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf') return 8;
  return 18;
}

function formatAmount(raw: bigint, decimals: number) {
  const value = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(value)) return formatUnits(raw, decimals);
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function MemberHomeProposalBody({
  proposalId,
  spaceId,
  documentId,
  documentSlug,
}: MemberHomeProposalBodyProps) {
  const t = useTranslations('MemberHome');
  const tVoting = useTranslations('ProposalDetails');
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId,
  });
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: spaceId ?? undefined,
  });
  const { voters } = useProposalVoters(
    proposalId != null ? documentSlug : undefined,
  );

  const canVote = proposalId != null && documentId != null;
  const yesVoters = (voters ?? []).filter((voter) => voter.vote === 'yes');
  const noVoters = (voters ?? []).filter((voter) => voter.vote === 'no');
  const yesCount = yesVoters.length || proposalDetails?.yesVotes || 0;
  const noCount = noVoters.length || proposalDetails?.noVotes || 0;
  const transfer = proposalDetails?.transfers[0];
  const tokenSymbol = transfer
    ? TOKENS.find(
        (token) => token.address.toLowerCase() === transfer.token.toLowerCase(),
      )?.symbol ??
      proposalDetails?.tokens.find(
        (token) =>
          token.address?.toLowerCase() === transfer.token.toLowerCase(),
      )?.symbol
    : null;
  const end = proposalDetails?.endTime;
  let closes: string | null = null;
  if (end) {
    if (isPast(end)) {
      closes = tVoting('voting.voteClosed');
    } else {
      const duration = intervalToDuration({ start: new Date(), end });
      const parts = [
        duration.days ? `${duration.days}d` : null,
        duration.hours ? `${duration.hours}h` : null,
        !duration.days && duration.minutes ? `${duration.minutes}m` : null,
      ].filter((part): part is string => Boolean(part));
      closes = parts.length
        ? t('closesIn', { time: parts.join(' ') })
        : tVoting('voting.voteClosingSoon');
    }
  }

  return (
    <div className="mt-3 grid gap-3">
      {closes || (transfer && tokenSymbol) ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {closes ? (
            <p className="text-1 tracking-[0.08em] text-neutral-11 uppercase">
              {closes}
            </p>
          ) : (
            <span />
          )}
          {transfer && tokenSymbol ? (
            <p className="text-2">
              <span className="font-medium text-foreground">
                {formatAmount(
                  transfer.rawAmount,
                  tokenDecimals(transfer.token),
                )}{' '}
                {tokenSymbol}
              </span>{' '}
              <span className="text-1 tracking-[0.08em] text-neutral-11 uppercase">
                {t('fromTreasury')}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
      {yesCount > 0 || noCount > 0 ? (
        <div className="flex items-center justify-between gap-3 text-1 text-neutral-11">
          <span className="flex items-center gap-2">
            <span>{t('yesCount', { count: yesCount })}</span>
            {yesVoters.length > 0 ? (
              <span className="flex -space-x-1">
                {yesVoters.slice(0, 3).map((voter) => (
                  <PersonAvatar
                    key={voter.address}
                    avatarSrc={voter.avatarUrl}
                    userName={voter.name}
                    size="sm"
                    shape="circle"
                  />
                ))}
              </span>
            ) : null}
          </span>
          <span>{t('noCount', { count: noCount })}</span>
        </div>
      ) : null}
      <div className="grid gap-4">
        <ProgressLine
          label={tVoting('voting.quorumMinParticipation')}
          value={proposalDetails?.quorumPercentage ?? 0}
          target={
            spaceDetails?.quorum != null ? Number(spaceDetails.quorum) : 0
          }
          hideTargets={spaceDetails?.quorum == null}
          indicatorColor="bg-accent-12"
        />
        <ProgressLine
          label={tVoting('voting.unityMinAlignment')}
          value={proposalDetails?.unityPercentage ?? 0}
          target={spaceDetails?.unity != null ? Number(spaceDetails.unity) : 0}
          hideTargets={spaceDetails?.unity == null}
          indicatorColor="bg-accent-9"
        />
      </div>
      {canVote ? (
        <MemberHomeVote proposalId={proposalId} documentId={documentId} />
      ) : (
        <p className="text-2 text-neutral-11">{t('voteNeedsChain')}</p>
      )}
    </div>
  );
}
