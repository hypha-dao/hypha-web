'use client';

import { useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { ListFilter, Play } from 'lucide-react';
import './network-exchange-card.css';
import { useLocale, useTranslations } from 'next-intl';
import {
  CAPITALS,
  NETWORK_FIELD_KINDS,
  parseCapitalKeys,
  type CapitalKey,
  type NetworkFieldSignal,
  type NetworkFieldSignalKind,
} from '@hypha-platform/core/client';
import { Popover, PopoverContent, PopoverTrigger } from '@hypha-platform/ui';
import type { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';
import { useHumanChatPanel } from '../common/human-chat-panel-context';
import { useOpenSpacePublicChat } from '../common/use-open-space-public-chat';
import { compactIndicativeAmount } from '../coherence/components/signal-indicative-amounts';
import { SignalVideoPlayer } from '../coherence/components/signal-video-player';
import { resolveSignalVideo } from '../coherence/utils/signal-video';
import { resolveDateFnsLocale } from '../utils/date-fns-locale';
import { CAPITAL_MARK } from './capital-marks';
import { NetworkExchangeShareCard } from './network-exchange-share-card';
import { NETWORK_RIGHT_PANEL_CLASS } from './network-right-cards';
import {
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

function plainText(value: string) {
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
  return out.replace(/\s+/g, ' ').trim();
}

function ExchangeMedia({
  src,
  videoUrl,
  alt,
  playLabel,
}: {
  src: string | null;
  videoUrl: string | null;
  alt: string;
  playLabel: string;
}) {
  const fileRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const video = resolveSignalVideo(videoUrl);
  const image = !failed && src ? src : null;
  if (!video && !image) return null;

  const play = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setPlaying(true);
    if (video?.kind === 'file') void fileRef.current?.play();
  };

  return (
    <div className="exchange-stage">
      {video?.kind === 'file' ? (
        <video
          ref={fileRef}
          src={video.src}
          poster={image ?? undefined}
          playsInline
          preload="metadata"
          controls={playing}
          onClick={(event) => event.stopPropagation()}
        />
      ) : video && playing ? (
        <SignalVideoPlayer
          video={video}
          title={alt}
          className="exchange-embed object-cover"
        />
      ) : image ? (
        <img src={image} alt={alt} onError={() => setFailed(true)} />
      ) : null}
      {video && !playing ? (
        <button
          type="button"
          className="exchange-play"
          aria-label={playLabel}
          onClick={play}
        >
          <Play aria-hidden />
        </button>
      ) : null}
    </div>
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

function toggleValue<T>(list: T[], value: T) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function ExchangeFilters({
  types,
  capitals,
  onTypes,
  onCapitals,
}: {
  types: NetworkFieldSignalKind[];
  capitals: CapitalKey[];
  onTypes: (next: NetworkFieldSignalKind[]) => void;
  onCapitals: (next: CapitalKey[]) => void;
}) {
  const t = useTranslations('NetworkExchange');
  const active = types.length > 0 || capitals.length > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('filterSignals')}
          title={t('filterSignals')}
          aria-pressed={active}
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center border bg-background text-muted-foreground hover:text-foreground',
            active ? 'border-foreground text-foreground' : 'border-border',
          )}
        >
          <ListFilter className="craft-icon" strokeWidth={1.25} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-none p-3"
        collisionPadding={16}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-1 font-medium uppercase tracking-[0.12em] text-neutral-11">
              {t('signalTypes')}
            </p>
            <div className="flex flex-wrap gap-1">
              {NETWORK_FIELD_KINDS.map((kind) => {
                const selected = types.includes(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onTypes(toggleValue(types, kind))}
                    className={cn(
                      'border px-2 py-1 text-1 uppercase tracking-[0.08em]',
                      selected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-background text-foreground hover:border-foreground',
                    )}
                  >
                    {typeLabel(kind, t)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-1 font-medium uppercase tracking-[0.12em] text-neutral-11">
              {t('formOfCapital')}
            </p>
            <div className="flex flex-wrap gap-1">
              {CAPITALS.map((key) => {
                const selected = capitals.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onCapitals(toggleValue(capitals, key))}
                    className={cn(
                      'border px-2 py-1 text-1 uppercase tracking-[0.08em]',
                      selected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-background text-foreground hover:border-foreground',
                    )}
                  >
                    <span aria-hidden className="mr-1">
                      {CAPITAL_MARK[key]}
                    </span>
                    {t(`capitals.${key}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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
  const [capitals, setCapitals] = useState<CapitalKey[]>([]);
  const [types, setTypes] = useState<NetworkFieldSignalKind[]>(
    isFieldKind(initialType) ? [initialType] : [],
  );
  const [selectedSlug, setSelectedSlug] = useState(signals[0]?.slug ?? '');
  const needle = query.trim().toLowerCase();

  const visible = useMemo(() => {
    return signals.filter((signal) => {
      if (types.length > 0 && !types.includes(signal.type)) return false;
      const signalCapital = capitalKey(signal.capital);
      if (
        capitals.length > 0 &&
        (!signalCapital || !capitals.includes(signalCapital))
      ) {
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
  }, [capitals, needle, signals, types]);

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
          <NetworkLiveSearch
            value={query}
            onChange={setQuery}
            placeholder={t('searchPlaceholder')}
            end={
              <ExchangeFilters
                types={types}
                capitals={capitals}
                onTypes={setTypes}
                onCapitals={setCapitals}
              />
            }
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
              {signals.length > 0 ? t('needsFilterEmpty') : empty}
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
                const payout = payoutText(signal, t);
                const impactCard =
                  signal.type === 'Impact' || signal.type === 'Action';
                const proofs = proofsBySpace.get(signal.spaceSlug) ?? {
                  action: 0,
                  impact: 0,
                };
                const story = plainText(signal.description);
                const chosen = signal.slug === selected?.slug;
                return (
                  <li key={signal.slug} className="flex">
                    <article
                      className={cn(
                        'flex w-full cursor-pointer flex-col border bg-background',
                        chosen ? 'border-foreground' : 'border-border',
                      )}
                      onClick={() => setSelectedSlug(signal.slug)}
                    >
                      <ExchangeMedia
                        src={signal.leadImage || signal.spaceLeadImage}
                        videoUrl={signal.videoUrl}
                        alt={signal.title}
                        playLabel={t('fieldVideo')}
                      />
                      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
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
                        <h2
                          className="exchange-title text-4 font-medium leading-snug"
                          style={{ fontFamily: 'var(--font-family-heading)' }}
                        >
                          {signal.title}
                        </h2>
                        <p className="text-1 uppercase tracking-[0.14em] text-neutral-11">
                          {signal.spaceTitle}
                        </p>
                        {story ? (
                          <p className="line-clamp-2 text-2 leading-relaxed text-neutral-11">
                            {story}
                          </p>
                        ) : null}
                        {impactCard ? (
                          <p className="flex flex-wrap gap-x-4 gap-y-1 text-1 text-neutral-11">
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
                        ) : payout ? (
                          <p className="font-mono text-2 text-foreground">
                            {payout}
                          </p>
                        ) : null}
                        <Link
                          href={`/${lang}/dho/${signal.spaceSlug}/coherence?signal=${signal.slug}`}
                          className="mt-auto self-start text-1 uppercase tracking-[0.14em] text-foreground underline-offset-4 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {t('openSignal')}
                        </Link>
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
                            className="inline-flex h-10 cursor-default items-center justify-center bg-foreground px-3 text-1 font-medium uppercase tracking-[0.14em] text-background"
                          >
                            {t('resource')}
                          </button>
                        ) : (
                          <Link
                            href={`/${lang}/dho/${signal.spaceSlug}`}
                            className="inline-flex h-10 items-center justify-center bg-foreground px-3 text-1 font-medium uppercase tracking-[0.14em] text-background"
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
                          className="inline-flex h-10 items-center justify-center border-l border-border bg-background px-3 text-1 font-medium uppercase tracking-[0.14em] hover:bg-neutral-2 disabled:opacity-40"
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
            type={types.length === 1 ? types[0] ?? null : null}
            preferredSlug={selected?.spaceSlug}
          />
        </aside>
      </div>
    </div>
  );
}
