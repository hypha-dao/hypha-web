'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import {
  parseCapitalKeys,
  type CapitalKey,
  type NetworkFieldSignal,
  type NetworkFieldSignalKind,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';
import { compactIndicativeAmount } from '../coherence/components/signal-indicative-amounts';
import { resolveDateFnsLocale } from '../utils/date-fns-locale';
import {
  NetworkRightColumn,
  type NetworkRailSpace,
} from './network-right-cards';
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
) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
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
  if (!payout) return t('noTreasuryLink');
  return t('payoutLine', {
    amount: compactIndicativeAmount(payout.amount),
    token: shortToken(payout.token),
  });
}

function linkedText(
  signals: NetworkFieldSignal[],
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>,
) {
  const payouts = signals.flatMap((signal) => signal.payouts);
  const linked = signals.filter((signal) => signal.payouts.length > 0).length;
  const tokens = new Set(payouts.map((payout) => payout.token.toLowerCase()));
  if (tokens.size === 1 && payouts[0]) {
    const total = payouts.reduce((sum, payout) => {
      const value = Number(payout.amount.replace(/,/g, ''));
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
    if (Number.isFinite(total) && total > 0) {
      return t('linkedAmount', {
        amount: compactIndicativeAmount(String(total)),
        token: shortToken(payouts[0].token),
        count: signals.length,
      });
    }
  }
  if (linked > 0) {
    return t('linkedLine', { linked, count: signals.length });
  }
  return t('signalCountLine', { count: signals.length });
}

export function NetworkFieldBoard({
  lang,
  variant,
  signals,
  empty,
}: {
  lang: Locale;
  variant: 'action' | 'impact';
  signals: NetworkFieldSignal[];
  empty: string;
}) {
  const t = useTranslations('NetworkExchange');
  const dateLocale = resolveDateFnsLocale(useLocale());
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(signals[0]?.slug ?? '');
  const [capital, setCapital] = useState<CapitalKey | 'all'>('all');
  const needle = query.trim().toLowerCase();

  const matched = useMemo(
    () =>
      signals.filter((signal) => {
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
      }),
    [capital, needle, signals],
  );
  const visible = useMemo(() => {
    if (variant === 'impact') return matched;
    return matched.filter((signal) => signal.type === 'Action');
  }, [matched, variant]);
  const selected =
    visible.find((signal) => signal.slug === selectedSlug) ??
    signals.find((signal) => signal.slug === selectedSlug) ??
    visible[0] ??
    signals[0];
  const spaces = useMemo(() => {
    const seen = new Map<string, NetworkRailSpace>();
    for (const signal of signals) {
      if (seen.has(signal.spaceSlug)) continue;
      seen.set(signal.spaceSlug, {
        slug: signal.spaceSlug,
        title: signal.spaceTitle,
        description: signal.spaceDescription,
        place: signal.place,
        leadImage: signal.spaceLeadImage ?? signal.leadImage,
        chatRoomId: signal.spaceChatRoomId,
        seeks: signal.spaceSeeks,
        offers: signal.spaceOffers,
      });
    }
    return [...seen.values()];
  }, [signals]);
  const impactCount = selected
    ? signals.filter(
        (signal) =>
          signal.spaceSlug === selected.spaceSlug &&
          (signal.type === 'Impact' || signal.type === 'Insight'),
      ).length
    : 0;

  const action = variant === 'action';

  return (
    <div
      className={
        action
          ? '@container min-w-0'
          : 'network-side-grid grid min-w-0 items-start gap-6'
      }
    >
      <div
        className={
          action
            ? 'flex min-w-0 flex-col gap-4 @4xl:h-[calc(100dvh-var(--menu-top-height,70px)-4rem)] @4xl:flex-row @4xl:items-stretch @4xl:overflow-hidden'
            : 'contents'
        }
      >
        <div
          className={cn(
            'flex min-w-0 flex-col',
            action ? 'min-h-0 w-full flex-1 gap-4' : 'gap-6',
          )}
        >
          <NetworkSectionHeader
            eyebrow={
              variant === 'impact'
                ? t('storiesFromTheField')
                : t('signalsFromTheField')
            }
            title={variant === 'impact' ? t('impactTitle') : t('actionTitle')}
          />
          <div className={action ? 'flex shrink-0 flex-col gap-4' : 'contents'}>
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
          </div>
          {variant === 'action' && visible.length > 0 ? (
            <p className="shrink-0 text-1 text-neutral-11">
              {linkedText(visible, t)}
            </p>
          ) : null}
          {visible.length === 0 ? (
            <p className="text-2 text-neutral-11">
              {signals.length === 0 ? empty : t('needsFilterEmpty')}
            </p>
          ) : variant === 'impact' ? (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((signal, index) => (
                <li
                  key={signal.slug}
                  className={cn(
                    index === 0 && 'md:col-span-2 xl:col-span-2 xl:row-span-2',
                  )}
                >
                  <StoryCard
                    lang={lang}
                    signal={signal}
                    featured={index === 0}
                    selected={signal.slug === selected?.slug}
                    onSelect={() => setSelectedSlug(signal.slug)}
                    t={t}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid content-start items-stretch gap-4 @4xl:min-h-0 @4xl:flex-1 @4xl:overflow-y-auto @3xl:grid-cols-2 @6xl:grid-cols-3">
              {visible.map((signal) => {
                const picked = signal.slug === selected?.slug;
                return (
                  <li key={signal.slug} className="flex">
                    <button
                      type="button"
                      aria-pressed={picked}
                      onClick={() => setSelectedSlug(signal.slug)}
                      className={cn(
                        'flex w-full flex-col border bg-background text-left hover:border-foreground',
                        picked
                          ? 'border-foreground bg-neutral-2 ring-1 ring-foreground'
                          : 'border-border',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 text-1',
                            badgeClass(signal.type),
                          )}
                        >
                          {typeLabel(signal.type, t)}
                        </span>
                        <span className="text-1 text-neutral-11">
                          {whenLabel(signal.updatedAt, dateLocale)}
                        </span>
                      </div>
                      <div className="border-b border-border">
                        <FieldPhoto src={signal.leadImage} alt="" />
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
                      </div>
                      <div
                        className={cn(
                          'border-t border-border px-4 py-3 font-mono text-1',
                          signal.payouts.length > 0
                            ? 'text-foreground'
                            : 'text-neutral-11',
                        )}
                      >
                        {payoutText(signal, t)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {action || selected ? (
          <NetworkRightColumn
            lang={lang}
            variant={variant}
            spaces={spaces}
            selectedSlug={selected?.spaceSlug ?? ''}
            payouts={selected?.payouts ?? []}
            impactCount={impactCount}
          />
        ) : null}
      </div>
    </div>
  );
}

function StoryCard({
  lang,
  signal,
  featured,
  selected,
  onSelect,
  t,
}: {
  lang: Locale;
  signal: NetworkFieldSignal;
  featured: boolean;
  selected: boolean;
  onSelect: () => void;
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>;
}) {
  const [failed, setFailed] = useState(false);
  const image = !failed && signal.leadImage ? signal.leadImage : null;
  const media = signal.videoUrl
    ? t('fieldVideo')
    : image
    ? t('photoMoment')
    : null;
  const byline = signal.creatorName
    ? t('byLine', { name: signal.creatorName, space: signal.spaceTitle })
    : signal.spaceTitle;
  return (
    <article
      className={cn(
        'relative flex min-h-[14rem] overflow-hidden border bg-neutral-3',
        featured && 'min-h-[28rem]',
        selected ? 'border-foreground' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="absolute inset-0 z-[1]"
        aria-label={signal.title}
      />
      {image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
      {media ? (
        <span
          className={cn(
            'absolute left-3 top-3 px-2 py-0.5 text-1 uppercase tracking-[0.12em]',
            image ? 'bg-black/70 text-white' : 'bg-foreground text-background',
          )}
        >
          {media}
        </span>
      ) : null}
      <div
        className={cn(
          'relative mt-auto flex w-full flex-col gap-1 p-4',
          image
            ? 'bg-gradient-to-t from-black/75 via-black/25 to-transparent text-white'
            : 'text-foreground',
        )}
      >
        <h2
          className={cn('leading-snug', featured ? 'text-6' : 'text-3')}
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {signal.title}
        </h2>
        <p
          className={cn('text-1', image ? 'text-white/85' : 'text-neutral-11')}
        >
          {byline}
        </p>
        <Link
          href={`/${lang}/dho/${signal.spaceSlug}/coherence?signal=${signal.slug}`}
          className="relative z-[2] mt-2 self-start text-1 uppercase tracking-[0.12em]"
        >
          {t('openSignal')}
        </Link>
      </div>
    </article>
  );
}
