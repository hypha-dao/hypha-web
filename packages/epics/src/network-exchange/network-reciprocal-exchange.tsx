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
import { useOpenSpacePublicChat } from '../common/use-open-space-public-chat';
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
    return <div className="aspect-[4/3] w-full bg-neutral-3" />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className="aspect-[4/3] w-full object-cover"
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
  const { open } = useHumanChatPanel();
  const { openPublicChat, opening } = useOpenSpacePublicChat();
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

  const proofsBySpace = useMemo(() => {
    const counts = new Map<string, { action: number; impact: number }>();
    for (const signal of signals) {
      const row = counts.get(signal.spaceSlug) ?? { action: 0, impact: 0 };
      if (signal.type === 'Action') row.action += 1;
      if (signal.type === 'Impact') row.impact += 1;
      counts.set(signal.spaceSlug, row);
    }
    return counts;
  }, [signals]);

  const openRoom = (signal: NetworkFieldSignal) => {
    if (!signal.spaceSlug || opening) return;
    void openPublicChat({
      slug: signal.spaceSlug,
      title: signal.spaceTitle,
      description: signal.spaceDescription,
    });
  };

  return (
    <div className="@container min-w-0">
      <div className="flex min-w-0 flex-col gap-4 @4xl:flex-row @4xl:items-start">
        <div className="@container flex min-w-0 flex-1 flex-col gap-4">
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
                const impactCard =
                  signal.type === 'Impact' || signal.type === 'Action';
                const proofs = proofsBySpace.get(signal.spaceSlug) ?? {
                  action: 0,
                  impact: 0,
                };
                return (
                  <li key={signal.slug} className="flex">
                    <article
                      className={cn(
                        'flex w-full flex-col border bg-background',
                        selectedCard ? 'border-foreground' : 'border-border',
                      )}
                      onClick={() => setSelectedSlug(signal.slug)}
                    >
                      <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 text-1 uppercase tracking-[0.08em]',
                            badgeClass(signal.type),
                          )}
                        >
                          {typeLabel(signal.type, t)}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1 truncate text-1 text-neutral-11">
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
                      <FieldPhoto src={signal.leadImage} alt={signal.title} />
                      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
                        <h2
                          className="text-4 font-medium leading-snug"
                          style={{ fontFamily: 'var(--font-family-heading)' }}
                        >
                          {signal.title}
                        </h2>
                        <p className="text-1 uppercase tracking-[0.14em] text-neutral-11">
                          {signal.spaceTitle}
                        </p>
                        {impactCard ? (
                          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-1 text-neutral-11">
                            <Link
                              href={`/${lang}/network/exchange?type=Action`}
                              className="hover:text-foreground"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {t('proofsOfAction', { count: proofs.action })}
                            </Link>
                            <Link
                              href={`/${lang}/network/exchange?type=Impact`}
                              className="hover:text-foreground"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {t('proofsOfImpact', { count: proofs.impact })}
                            </Link>
                          </p>
                        ) : (
                          <>
                            {payout ? (
                              <p className="font-mono text-1 text-foreground">
                                {payout}
                              </p>
                            ) : null}
                            <Link
                              href={`/${lang}/dho/${signal.spaceSlug}/coherence?signal=${signal.slug}`}
                              className="mt-auto self-start pt-2 text-1 uppercase tracking-[0.14em] text-foreground underline-offset-4 hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {t('openSignal')}
                            </Link>
                          </>
                        )}
                      </div>
                      <div className="mt-auto grid grid-cols-2 border-t border-border">
                        {impactCard ? (
                          <button
                            type="button"
                            aria-disabled="true"
                            title={t('resourceLater')}
                            aria-label={`${t('resource')}. ${t(
                              'resourceLater',
                            )}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            className="flex h-11 cursor-default items-center justify-center bg-foreground text-1 font-medium uppercase tracking-[0.14em] text-background"
                          >
                            {t('resource')}
                          </button>
                        ) : (
                          <Link
                            href={`/${lang}/dho/${signal.spaceSlug}`}
                            className="flex h-11 items-center justify-center bg-foreground text-1 font-medium uppercase tracking-[0.14em] text-background"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {t('visit')}
                          </Link>
                        )}
                        <button
                          type="button"
                          disabled={opening || !signal.spaceSlug}
                          onClick={(event) => {
                            event.stopPropagation();
                            openRoom(signal);
                          }}
                          className="flex h-11 items-center justify-center text-1 font-medium uppercase tracking-[0.14em] hover:bg-neutral-2 disabled:opacity-40"
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
        <aside
          className={cn(
            NETWORK_RIGHT_PANEL_CLASS,
            '@4xl:!w-[320px]',
            open && '@4xl:!hidden',
          )}
        >
          <NetworkExchangeShareCard
            lang={lang}
            type={type}
            preferredSlug={selected?.spaceSlug}
          />
        </aside>
      </div>
    </div>
  );
}
