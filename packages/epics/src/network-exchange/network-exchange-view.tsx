'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import {
  parseCapitalKeys,
  type CapitalKey,
  type NetworkExchangeSpace,
  type Space,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useHumanChatPanel } from '../common/human-chat-panel-context';
import { CAPITAL_MARK } from './capital-marks';
import { exchangePairs } from './exchange-match';
import { NetworkGlobeMap } from '../network-map/components/network-globe-map';
import { NetworkRightColumn } from './network-right-cards';
import {
  NetworkCapitalFilters,
  NetworkLiveSearch,
  NetworkSectionHeader,
} from './network-section-header';

const LIST_PAGE = 4;

export type ExchangeStats = {
  spaces: number;
  members: number | null;
  agreements: number | null;
};

function matchesQuery(space: NetworkExchangeSpace, query: string) {
  if (!query) return true;
  const haystack =
    `${space.title} ${space.place} ${space.description}`.toLowerCase();
  return haystack.includes(query);
}

function matchesCapital(
  space: NetworkExchangeSpace,
  capital: CapitalKey | 'all',
) {
  if (capital === 'all') return true;
  return (
    parseCapitalKeys(space.seeks).includes(capital) ||
    parseCapitalKeys(space.offers).includes(capital)
  );
}

export function NetworkExchangeView({
  lang,
  spaces,
  mapSpaces,
  stats,
}: {
  lang: Locale;
  spaces: NetworkExchangeSpace[];
  mapSpaces: Space[];
  stats: ExchangeStats;
}) {
  const t = useTranslations('NetworkExchange');
  const { openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');
  const [capital, setCapital] = useState<CapitalKey | 'all'>('all');
  const [picked, setPicked] = useState(spaces[0]?.slug ?? '');
  const [shownPairs, setShownPairs] = useState(LIST_PAGE);
  const number = new Intl.NumberFormat(lang);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      spaces.filter(
        (space) =>
          matchesQuery(space, needle) && matchesCapital(space, capital),
      ),
    [capital, needle, spaces],
  );
  const current =
    visible.find((space) => space.slug === picked) ?? visible[0] ?? spaces[0];
  const visibleMapSpaces = useMemo(() => {
    const allowed = new Set(visible.map((space) => space.slug));
    return mapSpaces.filter((space) => allowed.has(space.slug));
  }, [mapSpaces, visible]);
  const pairs = useMemo(() => exchangePairs(visible), [visible]);

  const railSpaces = spaces.map((space) => ({
    slug: space.slug,
    title: space.title,
    description: space.description,
    place: space.place,
    leadImage: space.leadImage,
    chatRoomId: space.chatRoomId,
    categories: space.categories,
    seeks: space.seeks,
    offers: space.offers,
  }));

  const counts = [
    { label: t('statSpaces'), value: stats.spaces },
    stats.members == null
      ? null
      : { label: t('statMembers'), value: stats.members },
    stats.agreements == null
      ? null
      : { label: t('statAgreements'), value: stats.agreements },
  ].filter((item): item is { label: string; value: number } => item != null);

  return (
    <div className="@container min-w-0">
      <div className="flex min-w-0 flex-col gap-4 @4xl:flex-row @4xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <NetworkSectionHeader
            eyebrow={t('sharingEconomy')}
            title={t('exchangeTitle')}
          />
          <NetworkLiveSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              setShownPairs(LIST_PAGE);
            }}
            placeholder={t('searchPlaceholder')}
          />
          <NetworkCapitalFilters
            value={capital}
            onChange={(value) => {
              setCapital(value);
              setShownPairs(LIST_PAGE);
            }}
            allLabel={t('allSpaces')}
            labelFor={(key) => t(`capitals.${key}`)}
          />

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-1">
              {(['map', 'list'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={cn(
                    'border px-3 py-1.5 text-1 uppercase tracking-[0.12em]',
                    view === option
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-neutral-11',
                  )}
                >
                  {option === 'map' ? t('exchangeMap') : t('exchangeList')}
                </button>
              ))}
            </div>
            <dl className="flex shrink-0">
              {counts.map((item, index) => (
                <div
                  key={item.label}
                  className={cn(
                    'min-w-[4.75rem] px-4',
                    index > 0 && 'border-l border-border',
                  )}
                >
                  <dd
                    className="text-7 font-medium tabular-nums leading-none"
                    style={{ fontFamily: 'var(--font-family-heading)' }}
                  >
                    {number.format(item.value)}
                  </dd>
                  <dt className="mt-1 text-1 text-neutral-11">{item.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {view === 'map' ? (
            <NetworkGlobeMap
              lang={lang}
              spaces={visibleMapSpaces}
              className="w-full"
              isActive
              showStage
              onSpaceSelect={(space) => setPicked(space.slug)}
            />
          ) : pairs.length === 0 ? (
            <p className="text-2 text-neutral-11">{t('exchangeEmpty')}</p>
          ) : (
            <ul className="grid gap-3">
              {pairs.slice(0, shownPairs).map((pair) => (
                <li
                  key={`${pair.left.slug}:${pair.right.slug}`}
                  className={cn(
                    'border p-4',
                    pair.left.slug === current?.slug ||
                      pair.right.slug === current?.slug
                      ? 'border-foreground'
                      : 'border-border',
                  )}
                >
                  <p className="text-3">
                    <button
                      type="button"
                      onClick={() => setPicked(pair.left.slug)}
                      className="text-left"
                    >
                      {pair.left.title}
                    </button>
                    <span aria-hidden> ⇄ </span>
                    <button
                      type="button"
                      onClick={() => setPicked(pair.right.slug)}
                      className="text-left"
                    >
                      {pair.right.title}
                    </button>
                  </p>
                  {pair.left.place || pair.right.place ? (
                    <p className="mt-1 text-1 text-neutral-11">
                      {[pair.left.place, pair.right.place]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <CapitalChips keys={pair.leftMeets} />
                    <p className="text-center">
                      <span
                        className="text-4 tabular-nums"
                        style={{ fontFamily: 'var(--font-family-heading)' }}
                      >
                        {pair.percent}%
                      </span>
                      <span className="mt-1 block text-1 text-neutral-11">
                        {t('reciprocity')}
                      </span>
                    </p>
                    <CapitalChips keys={pair.rightMeets} align="end" />
                  </div>
                  <div className="mt-2 h-1 bg-neutral-3">
                    <div
                      className="h-full bg-foreground"
                      style={{ width: `${pair.percent}%` }}
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled
                      title={t('resourceLater')}
                      className="border border-foreground bg-foreground px-3 py-1.5 text-1 uppercase tracking-[0.12em] text-background disabled:opacity-40"
                    >
                      {t('resource')}
                    </button>
                    <button
                      type="button"
                      disabled={!pair.left.chatRoomId}
                      onClick={() => {
                        if (!pair.left.chatRoomId) return;
                        openCoherenceChat(
                          pair.left.chatRoomId,
                          pair.left.title,
                          pair.left.slug,
                          pair.left.description,
                          pair.left.slug,
                        );
                        openHumanChatPanel();
                      }}
                      className="border border-border px-3 py-1.5 text-1 uppercase tracking-[0.12em] disabled:opacity-40"
                    >
                      {t('connect')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {view === 'list' && pairs.length > shownPairs ? (
            <button
              type="button"
              className="mt-3 text-1 uppercase tracking-[0.12em]"
              onClick={() => setShownPairs((count) => count + 10)}
            >
              {t('showMoreCount', {
                count: Math.min(10, pairs.length - shownPairs),
              })}
            </button>
          ) : null}
        </div>
        {current ? (
          <NetworkRightColumn
            lang={lang}
            variant="exchange"
            spaces={railSpaces}
            selectedSlug={current.slug}
          />
        ) : null}
      </div>
    </div>
  );
}

function CapitalChips({
  keys,
  align = 'start',
}: {
  keys: CapitalKey[];
  align?: 'start' | 'end';
}) {
  const t = useTranslations('NetworkExchange');
  if (keys.length === 0) return <span />;
  return (
    <span
      className={cn('flex flex-wrap gap-1', align === 'end' && 'justify-end')}
    >
      {keys.map((key) => (
        <span key={key} className="border border-border px-1.5 py-0.5 text-1">
          <span aria-hidden>{CAPITAL_MARK[key]} </span>
          {t(`capitals.${key}`)}
        </span>
      ))}
    </span>
  );
}
