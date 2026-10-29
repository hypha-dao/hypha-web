'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import {
  listSpaceAttentionLead,
  useJwt,
  type MemberHomeThreadItem,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';

import { getProposalPath, getSignalPath } from '../../common/get-path-function';
import { HOME_REFRESH_EVENT } from '../../people/components/member-home-resume';

function stripTags(value: string) {
  let out = '';
  let index = 0;
  while (index < value.length) {
    const open = value.indexOf('<', index);
    if (open === -1) {
      out += value.slice(index);
      break;
    }
    out += value.slice(index, open);
    const close = value.indexOf('>', open + 1);
    if (close === -1) {
      out += value.slice(open);
      break;
    }
    out += ' ';
    index = close + 1;
  }
  return out;
}

function plainSummary(value: string | null | undefined) {
  return stripTags(value ?? '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function itemHref(lang: Locale, item: MemberHomeThreadItem) {
  return item.kind === 'signal'
    ? getSignalPath(lang, item.spaceSlug, item.slug)
    : getProposalPath(lang, item.spaceSlug, item.slug);
}

export function SpaceAttention({
  lang,
  spaceSlug,
  turn = 0,
}: {
  lang: Locale;
  spaceSlug: string;
  /** Rotates which item leads, so a second visit is not the same card. */
  turn?: number;
}) {
  const t = useTranslations('OverviewOps');
  const tCoherence = useTranslations('CoherenceTab');
  const { jwt } = useJwt();
  const { data, isLoading, mutate } = useSWR<MemberIntelligence | null>(
    jwt ? ['/api/v1/people/me/intelligence', jwt] : null,
    async ([url, token]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 404) return null;
      if (!response.ok) return null;
      return (await response.json()) as MemberIntelligence;
    },
    {
      // Votes and signal status changes land elsewhere; keep this tile fresh.
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 30_000,
    },
  );

  useEffect(() => {
    const refresh = () => {
      void mutate();
    };
    window.addEventListener(HOME_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(HOME_REFRESH_EVENT, refresh);
  }, [mutate]);

  const lead = useMemo(() => {
    if (!data) return null;
    return listSpaceAttentionLead(data, spaceSlug, turn);
  }, [data, spaceSlug, turn]);

  if (!jwt) return null;

  const inSpace =
    data?.spaces.some((space) => space.slug === spaceSlug) ?? false;
  if (!isLoading && (!data || !inSpace) && lead == null) return null;

  const eyebrow = (item: MemberHomeThreadItem) => {
    if (item.category) {
      const typeKey = `types.${item.category}` as 'types.Need';
      if (tCoherence.has(typeKey)) return tCoherence(typeKey);
      return item.category;
    }
    return item.kind === 'proposal'
      ? tCoherence('documentStates.proposal')
      : tCoherence('signals');
  };

  if (!isLoading && lead == null) return null;

  return (
    <section className="craft-card p-4">
      <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
        {t('nowEyebrow')}
      </p>
      <h2
        className="mt-1 text-3 text-foreground"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('nowTitle')}
      </h2>
      {isLoading || lead == null ? (
        <div className="mt-4 grid gap-3">
          <div className="h-3 w-16 bg-neutral-3" />
          <div className="h-5 w-2/3 bg-neutral-3" />
          <div className="h-4 w-full bg-neutral-3" />
        </div>
      ) : (
        <Link href={itemHref(lang, lead)} className="group mt-4 block">
          <span className="text-1 uppercase tracking-[0.12em] text-foreground">
            {lead.kind === 'proposal'
              ? t('nowActionVote')
              : t('nowActionSignal')}
          </span>
          <span className="mt-2 block text-1 text-neutral-11">
            {eyebrow(lead)}
          </span>
          <span
            className="mt-1 block text-3 text-foreground group-hover:underline"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {lead.title}
          </span>
          {plainSummary(lead.summary) ? (
            <span className="mt-2 block line-clamp-4 text-2 text-neutral-11">
              {plainSummary(lead.summary)}
            </span>
          ) : null}
        </Link>
      )}
    </section>
  );
}
