'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import {
  CAPITALS,
  parseCapitalKeys,
  type CapitalKey,
  type NetworkExchangeSpace,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useHumanChatPanel } from '../common/human-chat-panel-context';
import { CAPITAL_MARK } from './capital-marks';
import { exchangePairs } from './exchange-match';
import { ExchangeWorldMap } from './exchange-world-map';
import { NetworkRightColumn } from './network-right-cards';

const MAP_LIMIT = 12;
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
  capital: CapitalKey | null,
) {
  if (!capital) return true;
  return (
    parseCapitalKeys(space.seeks).includes(capital) ||
    parseCapitalKeys(space.offers).includes(capital)
  );
}

function hasCoordinates(
  space: NetworkExchangeSpace,
): space is NetworkExchangeSpace & { latitude: number; longitude: number } {
  return (
    typeof space.latitude === 'number' &&
    typeof space.longitude === 'number' &&
    Number.isFinite(space.latitude) &&
    Number.isFinite(space.longitude) &&
    Math.abs(space.latitude) <= 90 &&
    Math.abs(space.longitude) <= 180 &&
    !(space.latitude === 0 && space.longitude === 0)
  );
}

export function NetworkExchangeView({
  lang,
  spaces,
  stats,
}: {
  lang: Locale;
  spaces: NetworkExchangeSpace[];
  stats: ExchangeStats;
}) {
  const t = useTranslations('NetworkExchange');
  const { openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');
  const [capital, setCapital] = useState<CapitalKey | null>(null);
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
  const mapSpaces = useMemo(() => {
    const placed = visible.filter(hasCoordinates);
    const named = placed.filter(
      (space) =>
        parseCapitalKeys(space.seeks).length > 0 ||
        parseCapitalKeys(space.offers).length > 0,
    );
    const rest = placed.filter((space) => !named.includes(space));
    return [...named, ...rest].slice(0, MAP_LIMIT);
  }, [visible]);
  const pairs = useMemo(() => exchangePairs(visible), [visible]);
  const mapPairs = useMemo(
    () => exchangePairs(mapSpaces).slice(0, 8),
    [mapSpaces],
  );

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
    <div className="network-side-grid network-exchange-grid grid min-w-0 items-start gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="w-full max-w-[18rem]">
            <p className="text-1 uppercase tracking-[0.16em] text-neutral-11">
              {t('sharingEconomy')}
            </p>
            <h1
              className="mt-2 text-balance text-8 font-medium leading-[1.05] tracking-[-0.03em]"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('exchangeTitle')}
            </h1>
          </div>
          <dl className="flex shrink-0 pt-1">
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

        <div className="mt-5 flex gap-1">
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

        <form
          className="mt-3 flex border border-border bg-background"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="flex min-w-0 flex-1 items-center gap-2 px-3">
            <Search className="size-4 shrink-0 text-neutral-11" aria-hidden />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShownPairs(LIST_PAGE);
              }}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="h-10 min-w-0 flex-1 bg-transparent text-2 outline-none placeholder:text-neutral-11"
            />
          </label>
          <button
            type="submit"
            className="border-l border-border px-4 text-1 uppercase tracking-[0.12em]"
          >
            {t('search')}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-1">
          <button
            type="button"
            aria-pressed={capital == null}
            onClick={() => setCapital(null)}
            className={cn(
              'border px-2 py-1 text-1',
              capital == null
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-neutral-11',
            )}
          >
            {t('allSpaces')}
          </button>
          {CAPITALS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={capital === key}
              onClick={() => {
                setCapital(key);
                setShownPairs(LIST_PAGE);
              }}
              className={cn(
                'border px-2 py-1 text-1',
                capital === key
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-neutral-11',
              )}
            >
              {t(`capitals.${key}`)}
            </button>
          ))}
        </div>

        {view === 'map' ? (
          <div className="relative mt-3 h-[min(40rem,calc(100dvh-14rem))] min-h-[24rem] border border-border bg-background">
            <ExchangeWorldMap
              nodes={mapSpaces.map((space) => ({
                slug: space.slug,
                title: space.title,
                latitude: space.latitude,
                longitude: space.longitude,
              }))}
              arcs={mapPairs.map((pair) => ({
                from: pair.left.slug,
                to: pair.right.slug,
                percent: pair.percent,
              }))}
              selectedSlug={current?.slug ?? ''}
              onSelect={setPicked}
              label={t('exchangeMap')}
            />
            {mapSpaces.length === 0 ? (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-2 text-neutral-11">
                {t('mapEmpty')}
              </p>
            ) : null}
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-1 text-neutral-11">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-foreground" />
                {t('projectKind')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-6 border-t border-dashed border-foreground" />
                {t('statAgreements')}
              </span>
              <span>
                {t('statSpaces')} · {number.format(mapSpaces.length)}
              </span>
            </div>
          </div>
        ) : pairs.length === 0 ? (
          <p className="mt-6 text-2 text-neutral-11">{t('exchangeEmpty')}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
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
