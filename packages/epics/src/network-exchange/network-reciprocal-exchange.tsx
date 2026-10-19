'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import {
  NETWORK_FIELD_KINDS,
  parseCapitalKeys,
  type CapitalKey,
  type NetworkFieldSignal,
  type NetworkFieldSignalKind,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';
import { useHumanChatPanel } from '../common/human-chat-panel-context';
import { compactIndicativeAmount } from '../coherence/components/signal-indicative-amounts';
import { resolveDateFnsLocale } from '../utils/date-fns-locale';
import { CAPITAL_MARK } from './capital-marks';
import { NetworkExchangeShareCard } from './network-exchange-share-card';
import { NETWORK_RIGHT_PANEL_CLASS } from './network-right-cards';
import {
  NetworkCapitalFilters,
  NetworkLiveSearch,
  NetworkSectionHeader,
} from './network-section-header';

function typeLabel(
  type: NetworkFieldSignalKind,
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>,
) {
  if (type === 'Need') return t('filterNeed');
  if (type === 'Resource') return t('filterResource');
  if (type === 'Opportunity') return t('filterOpportunity');
  if (type === 'Risk') return t('filterRisk');
  if (type === 'Tension') return t('filterTension');
  if (type === 'Insight') return t('filterInsight');
  if (type === 'Action') return t('filterAction');
  return t('filterImpact');
}

function badgeClass(type: NetworkFieldSignalKind) {
  if (type === 'Risk') return 'bg-error-3 text-error-11';
  if (type === 'Tension') return 'bg-warning-3 text-warning-11';
  if (type === 'Action' || type === 'Opportunity') {
    return 'bg-foreground/10 text-foreground';
  }
  if (type === 'Need') return 'bg-foreground text-background';
  return 'bg-neutral-3 text-foreground';
}

function capitalKey(value: string | null): CapitalKey | null {
  if (!value) return null;
  return parseCapitalKeys([value])[0] ?? null;
}

function shortToken(token: string) {
  const trimmed = token.trim();
  if (/^hypha$/i.test(trimmed)) return 'HYPHA';
  if (trimmed.startsWith('0x') && trimmed.length > 10) {
    return `${trimmed.slice(0, 8)}…`;
  }
  return trimmed;
}

function whenLabel(
  iso: string | null,
  locale: ReturnType<typeof resolveDateFnsLocale>,
  ongoing: string,
) {
  if (!iso) return ongoing;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return ongoing;
  return formatDistanceToNowStrict(date, { addSuffix: true, locale });
}

function FieldPhoto({ src, alt }: { src: string | null; alt: string }) {
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

function payoutText(
  signal: NetworkFieldSignal,
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>,
) {
  const payout = signal.payouts[0];
  if (!payout) return null;
  return t('payoutLine', {
    amount: compactIndicativeAmount(payout.amount),
    token: shortToken(payout.token),
  });
}

function isFieldKind(
  value: string | undefined,
): value is NetworkFieldSignalKind {
  return (
    typeof value === 'string' &&
    (NETWORK_FIELD_KINDS as readonly string[]).includes(value)
  );
}

export function NetworkReciprocalExchange({
  lang,
  signals,
  empty,
  initialType,
}: {
  lang: Locale;
  signals: NetworkFieldSignal[];
  empty: string;
  initialType?: string;
}) {
  const t = useTranslations('NetworkExchange');
  const dateLocale = resolveDateFnsLocale(useLocale());
  const { open, openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const [query, setQuery] = useState('');
  const [capital, setCapital] = useState<CapitalKey | 'all'>('all');
  const [type, setType] = useState<NetworkFieldSignalKind>(
    isFieldKind(initialType) ? initialType : 'Need',
  );
  const [selectedSlug, setSelectedSlug] = useState(signals[0]?.slug ?? '');
  const needle = query.trim().toLowerCase();

  const visible = useMemo(() => {
    return signals.filter((signal) => {
      if (signal.type !== type) return false;
      if (capital !== 'all' && capitalKey(signal.capital) !== capital) {
        return false;
      }
      if (!needle) return true;
      return [
        signal.title,
        signal.description,
        signal.spaceTitle,
        signal.place,
        signal.creatorName,
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [capital, needle, signals, type]);

  const selected =
    visible.find((signal) => signal.slug === selectedSlug) ?? visible[0];
  const spaceCount = useMemo(
    () => new Set(visible.map((signal) => signal.spaceSlug)).size,
    [visible],
  );

  const openRoom = (signal: NetworkFieldSignal) => {
    if (!signal.spaceChatRoomId) return;
    openCoherenceChat(
      signal.spaceChatRoomId,
      signal.spaceTitle,
      signal.slug,
      signal.description,
      signal.spaceSlug,
    );
    openHumanChatPanel();
  };

  return (
    <div className="@container min-w-0">
      <div className="flex min-w-0 flex-col gap-4 @4xl:flex-row @4xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <NetworkSectionHeader
            eyebrow={t('signalsFromTheField')}
            title={t('reciprocalTitle')}
          />
          <div
            className="flex flex-wrap gap-1 sm:flex-nowrap sm:overflow-x-auto sm:pb-1"
            role="tablist"
            aria-label={t('reciprocalTitle')}
          >
            {NETWORK_FIELD_KINDS.map((kind) => {
              const selectedTab = kind === type;
              return (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab}
                  onClick={() => setType(kind)}
                  className={cn(
                    'shrink-0 border px-3 py-1.5 text-1 uppercase tracking-[0.1em]',
                    selectedTab
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-foreground hover:border-foreground',
                  )}
                >
                  {typeLabel(kind, t)}
                </button>
              );
            })}
          </div>
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
          {visible.length > 0 ? (
            <p className="text-1 text-neutral-11">
              {t('exchangeSummary', {
                count: visible.length,
                spaces: spaceCount,
              })}
            </p>
          ) : null}
          {visible.length === 0 ? (
            <p className="text-2 text-neutral-11">
              {signals.some((signal) => signal.type === type)
                ? t('needsFilterEmpty')
                : empty}
            </p>
          ) : (
            <ul className="grid content-start grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
              {visible.map((signal) => {
                const picked = capitalKey(signal.capital);
                const when = whenLabel(
                  signal.updatedAt,
                  dateLocale,
                  t('ongoing'),
                );
                const selectedCard = signal.slug === selected?.slug;
                const payout = payoutText(signal, t);
                return (
                  <li key={signal.slug} className="flex">
                    <article
                      className={cn(
                        'flex w-full flex-col border bg-background',
                        selectedCard ? 'border-foreground' : 'border-border',
                      )}
                      onClick={() => setSelectedSlug(signal.slug)}
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 text-[10px]',
                            badgeClass(signal.type),
                          )}
                        >
                          {typeLabel(signal.type, t)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-1 text-neutral-11">
                          {picked ? (
                            <span aria-hidden>{CAPITAL_MARK[picked]}</span>
                          ) : null}
                          {picked
                            ? t('capitalStatus', {
                                capital: t(`capitals.${picked}`),
                                status: when,
                              })
                            : when}
                        </span>
                      </div>
                      <div className="border-b border-border">
                        <FieldPhoto src={signal.leadImage} alt={signal.title} />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <h2
                          className="text-3 leading-snug"
                          style={{ fontFamily: 'var(--font-family-heading)' }}
                        >
                          {signal.title}
                        </h2>
                        <p className="text-1 uppercase text-neutral-11">
                          {signal.spaceTitle}
                        </p>
                        {payout ? (
                          <p className="font-mono text-1 text-foreground">
                            {payout}
                          </p>
                        ) : null}
                        <Link
                          href={`/${lang}/dho/${signal.spaceSlug}/coherence?signal=${signal.slug}`}
                          className="self-start text-1 uppercase tracking-[0.12em] underline-offset-2 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {t('openSignal')}
                        </Link>
                      </div>
                      <div className="grid grid-cols-2 border-t border-border">
                        <Link
                          href={`/${lang}/dho/${signal.spaceSlug}`}
                          className="flex h-10 items-center justify-center bg-foreground text-1 font-semibold uppercase tracking-[0.12em] text-background"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {t('visit')}
                        </Link>
                        <button
                          type="button"
                          disabled={!signal.spaceChatRoomId}
                          title={
                            signal.spaceChatRoomId ? undefined : t('noRoom')
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            openRoom(signal);
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
          )}
        </div>
        {open ? null : (
          <aside className={NETWORK_RIGHT_PANEL_CLASS}>
            <NetworkExchangeShareCard
              lang={lang}
              type={type}
              preferredSlug={selected?.spaceSlug}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
