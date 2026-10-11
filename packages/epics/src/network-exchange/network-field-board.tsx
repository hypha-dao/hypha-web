'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CAPITALS,
  capitalLabel,
  parseCapitalKeys,
  type CapitalKey,
  type NetworkFieldSignal,
  type NetworkFieldSignalKind,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';
import { compactIndicativeAmount } from '../coherence/components/signal-indicative-amounts';
import { resolveDateFnsLocale } from '../utils/date-fns-locale';

const ACTION_TYPES: NetworkFieldSignalKind[] = [
  'Need',
  'Opportunity',
  'Risk',
  'Tension',
  'Insight',
  'Action',
  'Impact',
];

type TypeFilter = 'all' | NetworkFieldSignalKind;
type StoryFilter = 'all' | 'picture';

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
  if (type === 'Need') return 'bg-foreground text-background';
  if (type === 'Tension') return 'bg-warning-4 text-warning-12';
  if (type === 'Risk') return 'bg-error-3 text-error-12';
  return 'bg-neutral-3 text-foreground';
}

function capitalKey(value: string | null): CapitalKey | null {
  if (!value) return null;
  return parseCapitalKeys([value])[0] ?? null;
}

function shortToken(token: string) {
  if (token.startsWith('0x') && token.length > 10)
    return `${token.slice(0, 8)}…`;
  return token;
}

function hasPicture(signal: NetworkFieldSignal) {
  return Boolean(signal.leadImage || signal.videoUrl);
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

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'border px-3 py-1.5 text-1',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function FieldPhoto({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="aspect-[16/10] w-full bg-neutral-3" />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className="aspect-[16/10] w-full object-cover"
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
  const [capital, setCapital] = useState<CapitalKey | 'all'>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [story, setStory] = useState<StoryFilter>('all');
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
    if (variant === 'impact') {
      return story === 'picture' ? matched.filter(hasPicture) : matched;
    }
    return type === 'all'
      ? matched
      : matched.filter((signal) => signal.type === type);
  }, [matched, story, type, variant]);
  const pictured = matched.filter(hasPicture).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-1 uppercase tracking-[0.16em] text-neutral-11">
          {variant === 'impact'
            ? t('storiesFromTheField')
            : t('signalsFromTheField')}
        </p>
        <h1
          className="mt-2 text-8"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {variant === 'impact' ? t('impactTitle') : t('actionTitle')}
        </h1>
      </header>
      <form
        className="flex border border-border bg-background"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 px-3">
          <Search className="size-4 shrink-0 text-neutral-11" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent py-3 text-2 outline-none placeholder:text-neutral-11"
          />
        </label>
        <button
          type="submit"
          className="border-l border-border px-5 text-1 uppercase tracking-[0.12em]"
        >
          {t('search')}
        </button>
      </form>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('allSpaces')}
      >
        <Chip selected={capital === 'all'} onClick={() => setCapital('all')}>
          {t('allSpaces')}
        </Chip>
        {CAPITALS.map((item) => (
          <Chip
            key={item.key}
            selected={capital === item.key}
            onClick={() => setCapital(item.key)}
          >
            {capitalLabel(item.key)}
          </Chip>
        ))}
      </div>
      {variant === 'action' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Chip selected={type === 'all'} onClick={() => setType('all')}>
            {t('filterAll')}
          </Chip>
          {ACTION_TYPES.map((option) => (
            <Chip
              key={option}
              selected={type === option}
              onClick={() => setType(option)}
            >
              {typeLabel(option, t)}
            </Chip>
          ))}
          {signals.length > 0 ? (
            <p className="ml-auto text-1 text-neutral-11">
              {linkedText(visible, t)}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Chip selected={story === 'all'} onClick={() => setStory('all')}>
            {t('allStories', { count: matched.length })}
          </Chip>
          <Chip
            selected={story === 'picture'}
            onClick={() => setStory('picture')}
          >
            {t('withPicture', { count: pictured })}
          </Chip>
        </div>
      )}
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
                t={t}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((signal) => (
            <li key={signal.slug} className="flex">
              <Link
                href={`/${lang}/dho/${signal.spaceSlug}/coherence?signal=${signal.slug}`}
                className="flex w-full flex-col border border-border bg-background"
              >
                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="flex items-center justify-between gap-3">
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
                  <FieldPhoto src={signal.leadImage} alt="" />
                  <h2
                    className="line-clamp-2 text-3 leading-snug"
                    style={{ fontFamily: 'var(--font-family-heading)' }}
                  >
                    {signal.title}
                  </h2>
                  <p className="text-1 uppercase tracking-[0.14em] text-neutral-11">
                    {signal.spaceTitle}
                  </p>
                </div>
                <p
                  className={cn(
                    'border-t border-border px-3 py-3 text-1',
                    signal.payouts.length > 0
                      ? 'text-foreground'
                      : 'text-neutral-11',
                  )}
                >
                  {payoutText(signal, t)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StoryCard({
  lang,
  signal,
  featured,
  t,
}: {
  lang: Locale;
  signal: NetworkFieldSignal;
  featured: boolean;
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
    <Link
      href={`/${lang}/dho/${signal.spaceSlug}/coherence?signal=${signal.slug}`}
      className={cn(
        'relative flex min-h-[14rem] overflow-hidden border border-border bg-neutral-3',
        featured && 'min-h-[28rem]',
      )}
    >
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
      </div>
    </Link>
  );
}
