'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { ArrowUpRight, ChevronDown, Users, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Skeleton } from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import type { Locale } from '@hypha-platform/i18n';
import {
  collapseCategoriesToGroups,
  DEFAULT_SPACE_LEAD_IMAGE,
  getCategoryGroupLabel,
  parseCapitalKeys,
  type Space,
  type NetworkSpaceRank,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { NetworkRanking } from '../../network-exchange';

type TreasuryAsset = {
  symbol: string;
  value: number;
};

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

function excerpt(value: string | null | undefined) {
  const text = stripTags(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 220) return text;
  return `${text.slice(0, 219).trimEnd()}…`;
}

function leadImageSrc(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (trimmed.startsWith('/') || trimmed.startsWith('https://')) return trimmed;
  return DEFAULT_SPACE_LEAD_IMAGE;
}

function formatAmount(value: number, lang: string) {
  return new Intl.NumberFormat(lang, {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function useSpaceTreasury(slug: string | null) {
  const { getAccessToken } = useAuthentication();
  const { data, isLoading } = useSWR(
    slug ? [`/api/v1/spaces/${slug}/assets?bestEffort=true`] : null,
    async ([endpoint]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(endpoint, { headers });
      if (!response.ok) return [] as TreasuryAsset[];
      const body = (await response.json()) as {
        assets?: { symbol?: string; value?: number }[];
      };
      return (body.assets ?? []).flatMap((asset) => {
        if (!asset.symbol || !(asset.value && asset.value > 0)) return [];
        return [{ symbol: asset.symbol, value: asset.value }];
      });
    },
    { revalidateOnFocus: false },
  );
  return {
    assets: data ?? [],
    isLoading: Boolean(slug) && isLoading,
  };
}

function CapitalList({
  keys,
  empty,
}: {
  keys: ReturnType<typeof parseCapitalKeys>;
  empty: string;
}) {
  const t = useTranslations('NetworkExchange');
  if (keys.length === 0) {
    return <p className="mt-2 text-1 text-neutral-11">{empty}</p>;
  }
  return (
    <ul className="mt-2 grid gap-1.5">
      {keys.map((key) => (
        <li key={key} className="flex items-center gap-2 text-1">
          <span className="size-1.5 shrink-0 bg-foreground" aria-hidden />
          {t(`capitals.${key}`)}
        </li>
      ))}
    </ul>
  );
}

export function NetworkSidePanel({
  lang,
  selectedSpace,
  circles = [],
  capitals,
  onSelectRank,
  ranks,
}: {
  lang: Locale;
  selectedSpace: Space | null;
  circles?: Space[];
  capitals?: { seeks: string[]; offers: string[] } | null;
  onSelectRank: (rank: NetworkSpaceRank) => void;
  ranks: NetworkSpaceRank[];
}) {
  const t = useTranslations('NetworkExchange');
  const { assets, isLoading } = useSpaceTreasury(selectedSpace?.slug ?? null);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const seeks = parseCapitalKeys(capitals?.seeks);
  const offers = parseCapitalKeys(capitals?.offers);
  const summary = excerpt(selectedSpace?.description);
  const place = selectedSpace?.locationLabel?.trim() ?? '';
  const groups = collapseCategoriesToGroups(selectedSpace?.categories ?? []);
  const eyebrow = groups.length
    ? `${t('projectSpace')} · ${groups
        .map((id) => getCategoryGroupLabel(id))
        .join(' · ')}`
    : t('projectSpace');
  const spaceHref = selectedSpace?.slug
    ? `/${lang}/dho/${selectedSpace.slug}/overview`
    : null;
  const expanded = expandedSlug === selectedSpace?.slug;
  const visibleAssets = expanded ? assets : assets.slice(0, 4);
  const hiddenCount = Math.max(0, assets.length - visibleAssets.length);

  return (
    <aside
      aria-label={t('navNetwork')}
      className="flex min-w-0 flex-col bg-background lg:sticky lg:top-[var(--menu-top-height)] lg:max-h-[calc(100dvh-var(--menu-top-height))] lg:overflow-y-auto lg:border-l lg:border-border"
    >
      {selectedSpace ? (
        <section>
          <div className="relative h-44 overflow-hidden bg-neutral-3">
            <img
              src={leadImageSrc(selectedSpace.leadImage)}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-white">
              <p className="text-1 uppercase tracking-[0.12em] text-white/80">
                {eyebrow}
              </p>
              <h2
                className="mt-1 text-4 leading-tight"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {selectedSpace.title}
              </h2>
              {place ? (
                <p className="mt-1 text-1 text-white/80">{place}</p>
              ) : null}
            </div>
          </div>
          {summary ? (
            <p className="px-4 pt-4 text-1 leading-relaxed text-neutral-11">
              {summary}
            </p>
          ) : null}
          <div className="px-4 pt-4">
            <p className="flex items-center gap-2 text-1 uppercase tracking-[0.12em] text-neutral-11">
              <Wallet className="size-3.5" aria-hidden />
              {t('treasuryLive')}
            </p>
            {isLoading ? (
              <div className="mt-3 grid grid-cols-2 border border-border">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'px-3 py-3',
                      index % 2 === 1 && 'border-l border-border',
                      index >= 2 && 'border-t border-border',
                    )}
                  >
                    <Skeleton loading height="22px" width="4.5rem" />
                  </div>
                ))}
              </div>
            ) : visibleAssets.length > 0 ? (
              <>
                <div className="mt-3 grid grid-cols-2 border border-border">
                  {visibleAssets.map((asset, index) => (
                    <div
                      key={`${asset.symbol}:${index}`}
                      className={cn(
                        'px-3 py-3',
                        index % 2 === 1 && 'border-l border-border',
                        index >= 2 && 'border-t border-border',
                      )}
                    >
                      <p
                        className="text-4 tabular-nums"
                        style={{ fontFamily: 'var(--font-family-heading)' }}
                      >
                        {formatAmount(asset.value, lang)}
                      </p>
                      <p className="mt-1 text-1 uppercase tracking-[0.08em] text-neutral-11">
                        {asset.symbol}
                      </p>
                    </div>
                  ))}
                </div>
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-1 text-1 uppercase tracking-[0.12em]"
                    onClick={() => setExpandedSlug(selectedSpace.slug)}
                  >
                    {t('showMoreCount', { count: hiddenCount })}
                    <ChevronDown className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-1 text-neutral-11">
                {t('noTreasuryLink')}
              </p>
            )}
          </div>
          {circles.length > 0 ? (
            <div className="px-4 pt-5">
              <p className="flex items-center gap-2 text-1 uppercase tracking-[0.12em] text-neutral-11">
                <Users className="size-3.5" aria-hidden />
                {t('governanceCircles')}
              </p>
              <ul className="mt-2">
                {circles.map((circle) => (
                  <li
                    key={circle.id}
                    className="flex items-baseline justify-between gap-3 border-b border-border py-2"
                  >
                    <span className="min-w-0 truncate text-2">
                      {circle.title}
                    </span>
                    {circle.onChainDataMissing ? null : (
                      <span className="shrink-0 text-1 text-neutral-11">
                        {t('circleMembers', {
                          count: circle.memberCount ?? 0,
                        })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2 px-4 py-4">
            <div className="bg-neutral-2 p-3">
              <p className="text-1 uppercase tracking-[0.12em]">{t('seeks')}</p>
              <CapitalList keys={seeks} empty={t('noneYet')} />
            </div>
            <div className="bg-neutral-2 p-3">
              <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                {t('offers')}
              </p>
              <CapitalList keys={offers} empty={t('noneYet')} />
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-border">
            <Button
              type="button"
              disabled
              title={t('resourceLater')}
              aria-label={`${t('resource')}. ${t('resourceLater')}`}
              className="h-11"
            >
              {t('resource')}
            </Button>
            {spaceHref ? (
              <Button
                asChild
                variant="outline"
                colorVariant="neutral"
                className="h-11 border-y-0 border-r-0"
              >
                <Link href={spaceHref}>
                  {t('visit')}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
      {ranks.length > 0 ? (
        <section className="border-t border-border p-4">
          <NetworkRanking lang={lang} ranks={ranks} onSelect={onSelectRank} />
        </section>
      ) : null}
    </aside>
  );
}
