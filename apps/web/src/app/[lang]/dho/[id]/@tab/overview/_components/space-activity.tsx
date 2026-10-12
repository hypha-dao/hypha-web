'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  useProposalDetailsWeb3Rpc,
  useProposalVoters,
} from '@hypha-platform/core/client';

function ActivityVoteLine({
  status,
  proposalId,
  slug,
  fallback,
}: {
  status: 'accepted' | 'rejected' | 'onVoting';
  proposalId: number | null;
  slug?: string;
  fallback: string;
}) {
  const t = useTranslations('OverviewOps');
  const { proposalDetails, isLoading: detailsLoading } =
    useProposalDetailsWeb3Rpc({
      proposalId,
    });
  const { voters, isLoading: votersLoading } = useProposalVoters(slug);
  if ((proposalId == null && !slug) || (detailsLoading && votersLoading)) {
    return <span className="text-1 text-neutral-11">{fallback}</span>;
  }
  if (proposalDetails == null && voters == null) {
    return <span className="text-1 text-neutral-11">{fallback}</span>;
  }

  const yesVoters = (voters ?? []).filter((voter) => voter.vote === 'yes');
  const noVoters = (voters ?? []).filter((voter) => voter.vote === 'no');
  const yes = yesVoters.length || proposalDetails?.yesVotes || 0;
  const no = noVoters.length || proposalDetails?.noVotes || 0;
  const counted = yes + no > 0;
  const sentence =
    status === 'accepted'
      ? counted
        ? t('activityPassedCount', { yes, no })
        : t('activityPassed')
      : status === 'rejected'
      ? counted
        ? t('activityFailedCount', { yes, no })
        : t('activityFailed')
      : counted
      ? t('activityOpenCount', { yes, no })
      : t('activityOpen');

  return <span className="text-1 text-neutral-11">{sentence}</span>;
}

export function SpaceActivityList({
  items,
  hrefFor,
  untitled,
  statusLabel,
}: {
  items: Array<{
    id: number;
    title?: string | null;
    description?: string | null;
    slug?: string | null;
    web3ProposalId: number | null;
    status?: 'accepted' | 'rejected' | 'onVoting';
  }>;
  hrefFor: (slug: string | null | undefined) => string;
  untitled: string;
  statusLabel: (
    status: 'accepted' | 'rejected' | 'onVoting' | undefined,
  ) => string;
}) {
  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const status = item.status;
        return (
          <Link
            key={item.id}
            href={hrefFor(item.slug)}
            className="flex flex-col gap-1 border-b border-border/50 px-4 py-3.5 last:border-b-0 hover:bg-foreground/5"
          >
            <span className="truncate text-2 text-foreground">
              {item.title?.trim() || untitled}
            </span>
            {status ? (
              <ActivityVoteLine
                status={status}
                proposalId={item.web3ProposalId}
                slug={item.slug ?? undefined}
                fallback={statusLabel(status)}
              />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
