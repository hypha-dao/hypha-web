'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Radio, Scale } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import {
  listMemberHomeThreadItems,
  useJwt,
  type MemberHomeThreadItem,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';

import { getProposalPath, getSignalPath } from '../../common/get-path-function';
import { MemberHomeThreadCard } from '../../people/components/member-home-thread-card';
import { resolveSpaceDisplayLogoUrl } from '../utils/resolve-space-display-logo-url';

function plainSummary(value: string | null | undefined) {
  return (value ?? '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function AttentionMark({
  kind,
  iconUrl,
}: {
  kind: MemberHomeThreadItem['kind'];
  iconUrl?: string | null;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const Icon = kind === 'proposal' ? Scale : Radio;
  const showLogo = Boolean(iconUrl) && !logoFailed;
  return (
    <span className="craft-icon-box text-foreground" aria-hidden>
      {showLogo ? (
        <img
          src={iconUrl ?? undefined}
          alt=""
          className="size-full object-cover"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <Icon />
      )}
    </span>
  );
}

export function SpaceAttention({
  lang,
  spaceSlug,
}: {
  lang: Locale;
  spaceSlug: string;
}) {
  const t = useTranslations('MemberHome');
  const { resolvedTheme } = useTheme();
  const { jwt } = useJwt();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const { data, isLoading } = useSWR<MemberIntelligence | null>(
    jwt ? ['/api/v1/people/me/intelligence', jwt] : null,
    async ([url, token]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 404) return null;
      if (!response.ok) return null;
      return (await response.json()) as MemberIntelligence;
    },
  );

  const queue = useMemo(() => {
    if (!data) return [];
    return listMemberHomeThreadItems(data).filter(
      (item) => item.spaceSlug === spaceSlug,
    );
  }, [data, spaceSlug]);

  if (!jwt) return null;

  const inSpace =
    data?.spaces.some((space) => space.slug === spaceSlug) ?? false;
  if (!isLoading && data && !inSpace && queue.length === 0) return null;

  const lead = queue[0] ?? null;
  const rest = queue.slice(1, 5);
  const proposal =
    lead?.kind === 'proposal'
      ? data?.proposals.find((item) => item.slug === lead.slug) ?? null
      : null;

  return (
    <section className="border border-border bg-background p-4">
      <h2
        className="text-3 text-foreground"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('useful')}
      </h2>
      {isLoading ? (
        <div className="mt-4 grid gap-3">
          <div className="h-4 w-2/3 bg-muted" />
          <div className="h-4 w-1/2 bg-muted" />
          <div className="h-4 w-3/5 bg-muted" />
        </div>
      ) : lead == null ? (
        <p className="mt-4 text-1 text-neutral-11">{t('quiet')}</p>
      ) : (
        <div className="mt-4">
          <MemberHomeThreadCard
            lang={lang}
            item={lead}
            proposal={proposal}
            compact
            assistant={false}
            onAsk={() => undefined}
            onReach={async () => false}
          />
        </div>
      )}
      {rest.length > 0 ? (
        <div className="mt-6 border-t border-border pt-4">
          <h3
            className="text-3"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('waiting')}
          </h3>
          <ul className="mt-3 grid gap-3">
            {rest.map((item) => {
              const iconUrl = resolveSpaceDisplayLogoUrl(
                item.spaceLogo ?? null,
                logoVariant,
              );
              const href =
                item.kind === 'signal'
                  ? getSignalPath(lang, item.spaceSlug, item.slug)
                  : getProposalPath(lang, item.spaceSlug, item.slug);
              const summary = plainSummary(item.summary);
              return (
                <li key={`${item.kind}:${item.slug}`}>
                  <Link href={href} className="group flex items-center gap-3">
                    <AttentionMark kind={item.kind} iconUrl={iconUrl} />
                    <span className="min-w-0">
                      <span className="block text-1 group-hover:underline">
                        {item.title}
                      </span>
                      {summary ? (
                        <span className="mt-0.5 block line-clamp-2 text-1 text-neutral-11">
                          {summary}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
