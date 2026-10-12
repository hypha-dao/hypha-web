'use client';

import Link from 'next/link';
import { Check, Scale, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useProposalDetailsWeb3Rpc,
  useProposalVoters,
} from '@hypha-platform/core/client';

function plainSummary(value: string | null | undefined) {
  const text = (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 160) return text;
  return `${text.slice(0, 159).trimEnd()}…`;
}

function ActivityVoteLine({
  status,
  proposalId,
  slug,
}: {
  status: 'accepted' | 'rejected' | 'onVoting';
  proposalId: number | null;
  slug?: string;
}) {
  const t = useTranslations('OverviewOps');
  const { proposalDetails, isLoading: detailsLoading } =
    useProposalDetailsWeb3Rpc({
      proposalId,
    });
  const { voters, isLoading: votersLoading } = useProposalVoters(slug);
  if (proposalId == null && !slug) return null;
  if (detailsLoading && votersLoading) return null;
  if (proposalDetails == null && voters == null) return null;

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

  return <span className="mt-1 block text-1 text-neutral-12">{sentence}</span>;
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
    <>
      {items.map((item) => {
        const status = item.status;
        const Icon =
          status === 'accepted' ? Check : status === 'rejected' ? X : Scale;
        const summary = plainSummary(item.description);
        return (
          <Link
            key={item.id}
            href={hrefFor(item.slug)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-foreground/5"
          >
            <span className="craft-icon-box mt-0.5 text-foreground" aria-hidden>
              <Icon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-2 text-foreground">
                  {item.title?.trim() || untitled}
                </span>
                <span className="shrink-0 text-1 text-neutral-11">
                  {statusLabel(status)}
                </span>
              </span>
              {summary ? (
                <span className="mt-1 block text-1 leading-relaxed text-neutral-11">
                  {summary}
                </span>
              ) : null}
              {status ? (
                <ActivityVoteLine
                  status={status}
                  proposalId={item.web3ProposalId}
                  slug={item.slug ?? undefined}
                />
              ) : null}
            </span>
          </Link>
        );
      })}
    </>
  );
}
