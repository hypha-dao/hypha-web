'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import {
  parseCapitalKeys,
  type CapitalKey,
  type NetworkFieldSignalKind,
  type NetworkOpenNeed,
  type NetworkOpenNeedKind,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useHumanChatPanel } from '../common/human-chat-panel-context';
import { resolveDateFnsLocale } from '../utils/date-fns-locale';
import { CAPITAL_MARK } from './capital-marks';
import { NetworkRightColumn } from './network-right-cards';
import {
  NetworkCapitalFilters,
  NetworkLiveSearch,
  NetworkSectionHeader,
} from './network-section-header';

const FILTERS = ['all', 'Need', 'Risk', 'Tension'] as const;
type NeedFilter = (typeof FILTERS)[number];

function capitalKey(value: string | null): CapitalKey | null {
  if (!value) return null;
  return parseCapitalKeys([value])[0] ?? null;
}

function kindLabel(
  kind: NetworkFieldSignalKind | NetworkOpenNeedKind,
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>,
) {
  if (kind === 'Need') return t('filterNeed');
  if (kind === 'Opportunity') return t('filterOpportunity');
  if (kind === 'Risk') return t('filterRisk');
  if (kind === 'Tension') return t('filterTension');
  if (kind === 'Insight') return t('filterInsight');
  if (kind === 'Action') return t('filterAction');
  return t('filterImpact');
}

function badgeClass(type: NetworkOpenNeedKind) {
  if (type === 'Tension') return 'bg-warning-4 text-warning-12';
  if (type === 'Risk') return 'bg-error-3 text-error-12';
  return 'bg-foreground text-background';
}

function whenLabel(
  need: NetworkOpenNeed,
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>,
  dateLocale: ReturnType<typeof resolveDateFnsLocale>,
) {
  if (need.type === 'Need' || !need.updatedAt) return t('ongoing');
  const date = new Date(need.updatedAt);
  if (Number.isNaN(date.getTime())) return t('ongoing');
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: dateLocale,
  });
}

function NeedPhoto({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="aspect-video w-full bg-neutral-3" />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className="aspect-video w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function NetworkNeedsBoard({
  lang,
  needs,
  empty,
}: {
  lang: Locale;
  needs: NetworkOpenNeed[];
  empty: string;
}) {
  const t = useTranslations('NetworkExchange');
  const dateLocale = resolveDateFnsLocale(useLocale());
  const { open, openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const [filter, setFilter] = useState<NeedFilter>('all');
  const [capital, setCapital] = useState<CapitalKey | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(needs[0]?.slug ?? '');
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    return needs.filter((need) => {
      if (capital !== 'all' && capitalKey(need.capital) !== capital) {
        return false;
      }
      if (filter !== 'all' && need.type !== filter) return false;
      if (!needle) return true;
      return [need.title, need.description, need.spaceTitle, need.spacePlace]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [capital, filter, needle, needs]);
  const selected =
    visible.find((need) => need.slug === selectedSlug) ??
    visible[0] ??
    needs[0];
  const spaceCount = useMemo(
    () => new Set(needs.map((need) => need.spaceSlug)).size,
    [needs],
  );

  const openRoom = (need: NetworkOpenNeed) => {
    if (!need.spaceChatRoomId) return;
    openCoherenceChat(
      need.spaceChatRoomId,
      need.spaceTitle,
      need.slug,
      need.description,
      need.spaceSlug,
    );
    openHumanChatPanel();
  };

  return (
    <div className="@container min-w-0">
      <div className="flex min-w-0 flex-col gap-4 @4xl:flex-row @4xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <NetworkSectionHeader
            eyebrow={t('readFromSignals')}
            title={t('needsTitle')}
          />
          <NetworkLiveSearch
            value={query}
            onChange={setQuery}
            placeholder={t('searchPlaceholder')}
          />
          <NetworkCapitalFilters
            value={capital}
            onChange={setCapital}
            allLabel={t('allSpaces')}
            labelFor={(key) => t(`capitals.${key}`)}
          />
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label={t('needsTitle')}
          >
            {FILTERS.map((option) => {
              const selectedFilter = filter === option;
              const label =
                option === 'all' ? t('filterAll') : kindLabel(option, t);
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selectedFilter}
                  onClick={() => setFilter(option)}
                  className={cn(
                    'px-3 py-1 text-1',
                    selectedFilter
                      ? 'bg-foreground text-background'
                      : 'bg-neutral-2 text-neutral-11',
                  )}
                >
                  {label}
                </button>
              );
            })}
            {needs.length > 0 ? (
              <p className="basis-full text-1 text-neutral-11 sm:ml-auto sm:basis-auto sm:whitespace-nowrap">
                {t('needsSummary', { needs: needs.length, spaces: spaceCount })}
              </p>
            ) : null}
          </div>
          {visible.length === 0 ? (
            <p className="text-2 text-neutral-11">
              {needs.length === 0 ? empty : t('needsFilterEmpty')}
            </p>
          ) : null}
          {visible.length > 0 ? (
            <ul className="grid content-start grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
              {visible.map((need) => {
                const capital = capitalKey(need.capital);
                const when = whenLabel(need, t, dateLocale);
                const selectedCard = need.slug === selected?.slug;
                return (
                  <li key={need.slug} className="flex">
                    <article
                      className={cn(
                        'flex w-full flex-col border bg-background',
                        selectedCard ? 'border-foreground' : 'border-border',
                      )}
                      onClick={() => setSelectedSlug(need.slug)}
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 text-[10px]',
                            badgeClass(need.type),
                          )}
                        >
                          {kindLabel(need.type, t)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-1 text-neutral-11">
                          {capital ? (
                            <span aria-hidden>{CAPITAL_MARK[capital]}</span>
                          ) : null}
                          {capital
                            ? t('capitalStatus', {
                                capital: t(`capitals.${capital}`),
                                status: when,
                              })
                            : when}
                        </span>
                      </div>
                      <div className="border-b border-border">
                        <NeedPhoto src={need.leadImage} alt={need.title} />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <h2 className="text-3 leading-snug">{need.title}</h2>
                        <p className="text-1 uppercase text-neutral-11">
                          {need.spaceTitle}
                        </p>
                        <div className="flex gap-3 text-1">
                          <Link
                            href={`/${lang}/network/proof-of-action`}
                            className="underline-offset-2 hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {t('proofsOfAction', { count: need.actionCount })}
                          </Link>
                          <Link
                            href={`/${lang}/network/proof-of-impact`}
                            className="underline-offset-2 hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {t('proofsOfImpact', { count: need.impactCount })}
                          </Link>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 border-t border-border">
                        <button
                          type="button"
                          disabled
                          title={t('resourceLater')}
                          aria-label={`${t('resource')}. ${t('resourceLater')}`}
                          className="h-10 bg-foreground text-1 font-semibold uppercase tracking-[0.12em] text-background disabled:opacity-40"
                        >
                          {t('resource')}
                        </button>
                        <button
                          type="button"
                          disabled={!need.spaceChatRoomId}
                          title={need.spaceChatRoomId ? undefined : t('noRoom')}
                          onClick={(event) => {
                            event.stopPropagation();
                            openRoom(need);
                          }}
                          className="h-10 text-1 font-semibold uppercase tracking-[0.12em] hover:bg-neutral-2 disabled:opacity-40"
                        >
                          {t('connect')}
                        </button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        {open ? null : (
          <NetworkRightColumn
            lang={lang}
            variant="needs"
            spaces={[]}
            selectedSlug={selected?.spaceSlug ?? ''}
          />
        )}
      </div>
    </div>
  );
}
