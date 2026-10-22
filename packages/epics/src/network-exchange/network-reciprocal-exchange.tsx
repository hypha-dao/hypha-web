'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ListFilter,
  Maximize2,
  Play,
  X,
  type LucideIcon,
} from 'lucide-react';
import './network-exchange-card.css';
import { useLocale, useTranslations } from 'next-intl';
import {
  CAPITALS,
  COHERENCE_PRIORITIES,
  formatSignalDueDateLabel,
  isSignalDueOverdue,
  matchesDeadline,
  NETWORK_FIELD_KINDS,
  parseCapitalKeys,
  type CapitalKey,
  type NetworkFieldSignal,
  type NetworkFieldSignalKind,
  type SignalDeadlineFilter,
} from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Input,
  MultiSelect,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import type { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';
import {
  PRIORITY_DOT_MARK_CLASS,
  priorityDotClass,
} from '../coherence/utils/signal-priority-styles';
import { getDhoPathOverview } from '../common/get-path-function';
import { useHumanChatPanel } from '../common/human-chat-panel-context';
import { useOpenSpacePublicChat } from '../common/use-open-space-public-chat';
import { compactIndicativeAmount } from '../coherence/components/signal-indicative-amounts';
import { SignalVideoPlayer } from '../coherence/components/signal-video-player';
import {
  signalTypeIcon,
  SignalTypeBadge,
  SignalSpaceName,
} from '../coherence/components/signal-type-icon';
import {
  SIGNAL_BOARD_SELECT_TEXT_CLASS,
  SIGNAL_FILTER_MULTI_SELECT_CLASS,
} from '../coherence/utils/signal-tag-badge-styles';
import {
  resolveSignalVideo,
  signalVideoPoster,
  vimeoPosterId,
} from '../coherence/utils/signal-video';
import { resolveDateFnsLocale } from '../utils/date-fns-locale';
import {
  FUND_SPACE_DIALOG_CONTENT_CLASS,
  FUND_SPACE_DIALOG_OVERLAY_CLASS,
  FundASpaceFlow,
} from '../wallet/components/fund-a-space-flow';
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

function withAutoplay(src: string) {
  return `${src}${src.includes('?') ? '&' : '?'}autoplay=1`;
}

type FieldFile = { url: string; name: string };

function isPdfFile(file: FieldFile) {
  return /\.pdf(?:$|[?#])/i.test(`${file.name} ${file.url}`);
}

function ExchangeGallery({
  files,
  mode,
  title,
  downloadLabel,
  previousLabel,
  nextLabel,
  closeLabel,
  countLabel,
  onClose,
}: {
  files: FieldFile[];
  mode: 'photos' | 'documents';
  title: string;
  downloadLabel: string;
  previousLabel: string;
  nextLabel: string;
  closeLabel: string;
  countLabel: (current: number, total: number) => string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const file = files[index] ?? files[0];
  const total = files.length;
  const step = (direction: -1 | 1) => {
    setIndex((current) => (current + direction + total) % total);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % total);
      }
      if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + total) % total);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  if (!file) return null;
  const showImage =
    mode === 'photos' || (!isPdfFile(file) && mode !== 'documents');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        overlayClassName="bg-black/75"
        className="flex h-[min(88dvh,52rem)] w-[min(68rem,calc(100vw-var(--sidebar-left-width,0px)-var(--sidebar-right-width,0px)-2rem))] max-w-none flex-col gap-0 overflow-hidden border-border bg-background p-0"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogTitle className="sr-only">{file.name || title}</DialogTitle>
        <div className="relative min-h-0 flex-1 bg-neutral-2">
          {showImage ? (
            <img
              src={file.url}
              alt={file.name || title}
              className="absolute inset-0 size-full max-w-none object-contain"
            />
          ) : isPdfFile(file) ? (
            <iframe
              title={file.name || title}
              src={file.url}
              className="absolute inset-0 size-full border-0 bg-background"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-start justify-end gap-3 p-8">
              <FileText className="size-8" strokeWidth={1.25} aria-hidden />
              <p className="max-w-md text-4 font-medium">{file.name}</p>
            </div>
          )}
          <DialogClose
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center border border-white/40 bg-black/45 text-white hover:bg-black/70"
            aria-label={closeLabel}
          >
            <X className="size-4" strokeWidth={1.5} />
          </DialogClose>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <div className="flex items-center gap-1">
            {total > 1 ? (
              <>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center border border-border hover:border-foreground"
                  aria-label={previousLabel}
                  onClick={() => step(-1)}
                >
                  <ChevronLeft className="size-4" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center border border-border hover:border-foreground"
                  aria-label={nextLabel}
                  onClick={() => step(1)}
                >
                  <ChevronRight className="size-4" strokeWidth={1.5} />
                </button>
                <span className="px-2 text-1 text-neutral-11">
                  {countLabel(index + 1, total)}
                </span>
              </>
            ) : null}
          </div>
          <a
            href={file.url}
            download={file.name || undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 border border-border px-2 text-1 hover:border-foreground"
          >
            <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
            {downloadLabel}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExchangeMedia({
  images,
  videoUrl,
  documents,
  alt,
  playLabel,
}: {
  images: FieldFile[];
  videoUrl: string | null;
  documents: FieldFile[];
  alt: string;
  playLabel: string;
}) {
  const t = useTranslations('NetworkExchange');
  const fileRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [vimeoPoster, setVimeoPoster] = useState<string | null>(null);
  const [gallery, setGallery] = useState<'photos' | 'documents' | null>(null);
  const video = resolveSignalVideo(videoUrl);
  const photo = images[0]?.url ?? null;
  const image = !failed && photo ? photo : null;
  const document = documents[0] ?? null;
  const vimeoId = video ? vimeoPosterId(video) : null;

  useEffect(() => {
    if (!vimeoId || image) return;
    const controller = new AbortController();
    const load = async () => {
      const response = await fetch(
        `/api/v1/video-poster?id=${encodeURIComponent(vimeoId)}`,
        { signal: controller.signal },
      );
      if (!response.ok) return;
      const body = (await response.json()) as { thumbnail?: unknown };
      if (typeof body.thumbnail === 'string' && body.thumbnail) {
        setVimeoPoster(body.thumbnail);
      }
    };
    void load().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error('[ExchangeMedia] vimeo poster failed', error);
    });
    return () => controller.abort();
  }, [image, vimeoId]);

  if (!video && !image && !document) return null;

  const play = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setPlaying(true);
    if (video?.kind === 'file') void fileRef.current?.play();
  };
  const poster =
    image ?? (video ? signalVideoPoster(video) ?? vimeoPoster : null);

  return (
    <div className="exchange-stage">
      {video?.kind === 'file' ? (
        <video
          ref={fileRef}
          className="absolute inset-0 size-full max-w-none object-cover"
          src={image ? video.src : `${video.src}#t=0.5`}
          poster={image ?? undefined}
          playsInline
          preload="auto"
          muted={!playing}
          controls={playing}
          onLoadedMetadata={(event) => {
            const el = event.currentTarget;
            const mark = image ? 0.05 : 0.5;
            if (el.duration > mark && el.currentTime < mark) {
              el.currentTime = mark;
            }
          }}
          onClick={(event) => event.stopPropagation()}
        />
      ) : video && playing ? (
        <SignalVideoPlayer
          video={{ ...video, src: withAutoplay(video.src) }}
          title={alt}
          className="exchange-embed"
        />
      ) : poster ? (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 size-full max-w-none object-cover"
        />
      ) : image ? (
        <img
          src={image}
          alt={alt}
          className="absolute inset-0 size-full max-w-none object-cover"
          onError={() => setFailed(true)}
        />
      ) : document ? (
        <div className="exchange-file">
          {isPdfFile(document) ? (
            <iframe
              title={document.name}
              src={`${document.url}#toolbar=0&navpanes=0&view=FitH`}
              className="pointer-events-none absolute inset-0 size-full border-0"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-start justify-end gap-2 bg-neutral-2 p-4">
              <FileText className="size-7 text-foreground" strokeWidth={1.25} />
              <span className="line-clamp-2 text-2 font-medium text-foreground">
                {document.name}
              </span>
            </div>
          )}
        </div>
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
      {images.length > 0 || documents.length > 0 ? (
        <button
          type="button"
          className="exchange-view"
          aria-label={images.length > 0 ? t('viewPhotos') : t('viewDocuments')}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setGallery(images.length > 0 ? 'photos' : 'documents');
          }}
        >
          <Maximize2 className="size-3.5" strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
      {images.length > 0 && documents.length > 0 ? (
        <button
          type="button"
          className="exchange-view exchange-view-next"
          aria-label={t('viewDocuments')}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setGallery('documents');
          }}
        >
          <FileText className="size-3.5" strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
      {gallery ? (
        <ExchangeGallery
          files={gallery === 'photos' ? images : documents}
          mode={gallery}
          title={alt}
          downloadLabel={t('mediaDownload')}
          previousLabel={t('mediaPrevious')}
          nextLabel={t('mediaNext')}
          closeLabel={t('mediaClose')}
          countLabel={(current, total) => t('mediaCount', { current, total })}
          onClose={() => setGallery(null)}
        />
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

function FilterTag({
  label,
  icon: Icon,
  onRemove,
}: {
  label: string;
  icon?: LucideIcon;
  onRemove: () => void;
}) {
  const t = useTranslations('NetworkExchange');
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={t('removeFilter', { label })}
      className="inline-flex h-10 min-h-10 items-center gap-1.5 border border-border bg-background px-2 text-2 text-foreground hover:border-foreground"
    >
      {Icon ? (
        <Icon className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
      ) : null}
      <span>{label}</span>
      <X className="size-3 shrink-0" strokeWidth={1.25} aria-hidden />
    </button>
  );
}

const DEADLINE_MODES: SignalDeadlineFilter['mode'][] = [
  'before',
  'after',
  'between',
  'overdue',
  'none',
];

type ExchangePriority = NetworkFieldSignal['priority'];

function deadlineFilterLabel(
  deadline: SignalDeadlineFilter,
  modeLabel: string,
): string {
  const day = (iso: string | undefined) => {
    if (!iso) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return null;
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    );
    return Number.isNaN(date.getTime()) ? null : formatSignalDueDateLabel(date);
  };
  if (deadline.mode === 'before' || deadline.mode === 'after') {
    const label = day(deadline.date);
    return label ? `${modeLabel} · ${label}` : modeLabel;
  }
  if (deadline.mode === 'between') {
    const range = [day(deadline.from), day(deadline.to)]
      .filter((label): label is string => label != null)
      .join(' – ');
    return range ? `${modeLabel} · ${range}` : modeLabel;
  }
  return modeLabel;
}

function ExchangeFilters({
  types,
  capitals,
  priorities,
  deadline,
  onTypes,
  onCapitals,
  onPriorities,
  onDeadline,
}: {
  types: NetworkFieldSignalKind[];
  capitals: CapitalKey[];
  priorities: ExchangePriority[];
  deadline: SignalDeadlineFilter | null;
  onTypes: (next: NetworkFieldSignalKind[]) => void;
  onCapitals: (next: CapitalKey[]) => void;
  onPriorities: (next: ExchangePriority[]) => void;
  onDeadline: (next: SignalDeadlineFilter | null) => void;
}) {
  const t = useTranslations('NetworkExchange');
  const tSignals = useTranslations('CoherenceTab');
  const active =
    types.length > 0 ||
    capitals.length > 0 ||
    priorities.length > 0 ||
    deadline != null;
  const deadlineMode = deadline?.mode;
  const deadlineFrom =
    deadline && 'from' in deadline
      ? deadline.from ?? ''
      : deadline && 'date' in deadline
      ? deadline.date ?? ''
      : '';
  const deadlineTo =
    deadline && 'to' in deadline
      ? deadline.to ?? ''
      : deadline && 'date' in deadline
      ? deadline.date ?? ''
      : '';
  const typeOptions = NETWORK_FIELD_KINDS.map((kind) => ({
    value: kind,
    label: typeLabel(kind, t),
    icon: signalTypeIcon(kind),
  }));
  const capitalOptions = CAPITALS.map((key) => ({
    value: key,
    label: `${CAPITAL_MARK[key]} ${t(`capitals.${key}`)}`,
  }));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('filterSignals')}
          title={t('filterSignals')}
          aria-pressed={active}
          className={cn(
            'inline-flex h-6 w-6 shrink-0 items-center justify-center border bg-background text-muted-foreground hover:text-foreground',
            active ? 'border-foreground text-foreground' : 'border-border/70',
          )}
        >
          <ListFilter className="craft-icon" strokeWidth={1.25} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        onPointerDownOutside={(event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest(
              '[data-radix-popper-content-wrapper], [role="listbox"]',
            )
          ) {
            event.preventDefault();
          }
        }}
        className="narrow-scrollbar max-h-[var(--radix-popover-content-available-height,70dvh)] w-80 overflow-y-auto overscroll-contain rounded-none border-border bg-background p-0 text-foreground shadow-none"
      >
        <div className="grid gap-3 border-b border-border px-3 py-3">
          <label className="grid gap-1">
            <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
              {t('filterType')}
            </span>
            <MultiSelect
              options={typeOptions}
              value={[...types]}
              allowCreate={false}
              allowToggleAll={false}
              showFullSelection
              placeholder={t('filterTypesPlaceholder')}
              searchPlaceholder={t('filterOptionSearch')}
              textClassName={SIGNAL_BOARD_SELECT_TEXT_CLASS}
              className={cn(
                SIGNAL_BOARD_SELECT_TEXT_CLASS,
                SIGNAL_FILTER_MULTI_SELECT_CLASS,
              )}
              onValueChange={(values) =>
                onTypes(
                  NETWORK_FIELD_KINDS.filter((kind) => values.includes(kind)),
                )
              }
            />
          </label>
          <label className="grid gap-1">
            <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
              {t('formOfCapital')}
            </span>
            <MultiSelect
              options={capitalOptions}
              value={[...capitals]}
              allowCreate={false}
              allowToggleAll={false}
              showFullSelection
              placeholder={t('filterCapitalsPlaceholder')}
              searchPlaceholder={t('filterOptionSearch')}
              textClassName={SIGNAL_BOARD_SELECT_TEXT_CLASS}
              className={cn(
                SIGNAL_BOARD_SELECT_TEXT_CLASS,
                SIGNAL_FILTER_MULTI_SELECT_CLASS,
              )}
              onValueChange={(values) =>
                onCapitals(CAPITALS.filter((key) => values.includes(key)))
              }
            />
          </label>
          <label className="grid gap-1">
            <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
              {tSignals('priority')}
            </span>
            <MultiSelect
              options={COHERENCE_PRIORITIES.map((priority) => ({
                value: priority,
                label: tSignals(`priorities.${priority}`),
              }))}
              value={[...priorities]}
              allowCreate={false}
              allowToggleAll={false}
              showFullSelection
              placeholder={tSignals('filterPrioritiesPlaceholder')}
              searchPlaceholder={t('filterOptionSearch')}
              textClassName={SIGNAL_BOARD_SELECT_TEXT_CLASS}
              className={cn(
                SIGNAL_BOARD_SELECT_TEXT_CLASS,
                SIGNAL_FILTER_MULTI_SELECT_CLASS,
              )}
              onValueChange={(values) =>
                onPriorities(
                  COHERENCE_PRIORITIES.filter((priority) =>
                    values.includes(priority),
                  ),
                )
              }
            />
          </label>
          <label className="grid gap-1">
            <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
              {tSignals('filterDeadline')}
            </span>
            <Select
              value={deadlineMode ?? 'any'}
              onValueChange={(value) => {
                if (value === 'any') {
                  onDeadline(null);
                  return;
                }
                if (value === 'overdue' || value === 'none') {
                  onDeadline({ mode: value });
                  return;
                }
                if (value === 'between') {
                  onDeadline({
                    mode: 'between',
                    from: deadlineFrom || deadlineTo,
                    to: deadlineTo || deadlineFrom,
                  });
                  return;
                }
                onDeadline({
                  mode: value as 'before' | 'after',
                  date: deadlineTo || deadlineFrom,
                });
              }}
            >
              <SelectTrigger className="h-10 min-h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">
                  {tSignals('filterDeadlineAny')}
                </SelectItem>
                {DEADLINE_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {tSignals(`filterDeadline_${mode}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {deadlineMode === 'before' || deadlineMode === 'after' ? (
            <label className="grid gap-1">
              <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                {deadlineMode === 'after'
                  ? tSignals('filterDeadlineFrom')
                  : tSignals('filterDeadlineTo')}
              </span>
              <Input
                type="date"
                rootClassName="min-h-10"
                className="h-10 min-h-10"
                value={deadlineMode === 'after' ? deadlineFrom : deadlineTo}
                onChange={(event) => {
                  const date = event.target.value;
                  onDeadline(
                    date
                      ? { mode: deadlineMode, date }
                      : { mode: deadlineMode },
                  );
                }}
              />
            </label>
          ) : null}
          {deadlineMode === 'between' ? (
            <>
              <label className="grid gap-1">
                <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                  {tSignals('filterDeadlineFrom')}
                </span>
                <Input
                  type="date"
                  rootClassName="min-h-10"
                  className="h-10 min-h-10"
                  value={deadlineFrom}
                  onChange={(event) =>
                    onDeadline({
                      mode: 'between',
                      from: event.target.value,
                      to: deadlineTo,
                    })
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                  {tSignals('filterDeadlineTo')}
                </span>
                <Input
                  type="date"
                  rootClassName="min-h-10"
                  className="h-10 min-h-10"
                  value={deadlineTo}
                  onChange={(event) =>
                    onDeadline({
                      mode: 'between',
                      from: deadlineFrom,
                      to: event.target.value,
                    })
                  }
                />
              </label>
            </>
          ) : null}
        </div>
        {active ? (
          <div className="flex justify-end border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => {
                onTypes([]);
                onCapitals([]);
                onPriorities([]);
                onDeadline(null);
              }}
              className="text-1 text-neutral-11 hover:text-foreground"
            >
              {t('resetFilters')}
            </button>
          </div>
        ) : null}
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
  const tSignals = useTranslations('CoherenceTab');
  const tWallet = useTranslations('MyWallet');
  const dateLocale = resolveDateFnsLocale(useLocale());
  const { open } = useHumanChatPanel();
  const { openPublicChat, opening } = useOpenSpacePublicChat();
  const [query, setQuery] = useState('');
  const [capitals, setCapitals] = useState<CapitalKey[]>([]);
  const [priorities, setPriorities] = useState<ExchangePriority[]>([]);
  const [deadline, setDeadline] = useState<SignalDeadlineFilter | null>(null);
  const [types, setTypes] = useState<NetworkFieldSignalKind[]>(
    isFieldKind(initialType) ? [initialType] : [],
  );
  const [selectedSlug, setSelectedSlug] = useState(signals[0]?.slug ?? '');
  const [fundSpace, setFundSpace] = useState<{
    slug: string;
    title: string;
  } | null>(null);
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
      if (priorities.length > 0 && !priorities.includes(signal.priority)) {
        return false;
      }
      if (
        deadline &&
        !matchesDeadline(
          signal.dueAt ? new Date(signal.dueAt) : null,
          deadline,
          new Date(),
        )
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
  }, [capitals, deadline, needle, priorities, signals, types]);

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
          <div className="flex min-w-0 flex-col gap-2">
            <NetworkLiveSearch
              value={query}
              onChange={setQuery}
              placeholder={t('searchPlaceholder')}
              end={
                <ExchangeFilters
                  types={types}
                  capitals={capitals}
                  priorities={priorities}
                  deadline={deadline}
                  onTypes={setTypes}
                  onCapitals={setCapitals}
                  onPriorities={setPriorities}
                  onDeadline={setDeadline}
                />
              }
            />
            {types.length > 0 ||
            capitals.length > 0 ||
            priorities.length > 0 ||
            deadline != null ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {types.map((kind) => (
                  <FilterTag
                    key={kind}
                    label={typeLabel(kind, t)}
                    icon={signalTypeIcon(kind)}
                    onRemove={() =>
                      setTypes(types.filter((value) => value !== kind))
                    }
                  />
                ))}
                {capitals.map((key) => (
                  <FilterTag
                    key={key}
                    label={`${CAPITAL_MARK[key]} ${t(`capitals.${key}`)}`}
                    onRemove={() =>
                      setCapitals(capitals.filter((value) => value !== key))
                    }
                  />
                ))}
                {priorities.map((priority) => (
                  <FilterTag
                    key={priority}
                    label={tSignals(`priorities.${priority}`)}
                    onRemove={() =>
                      setPriorities(
                        priorities.filter((value) => value !== priority),
                      )
                    }
                  />
                ))}
                {deadline ? (
                  <FilterTag
                    label={deadlineFilterLabel(
                      deadline,
                      tSignals(`filterDeadline_${deadline.mode}`),
                    )}
                    onRemove={() => setDeadline(null)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
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
            <ul className="grid content-start grid-cols-1 gap-4 @lg:grid-cols-2 @3xl:grid-cols-3">
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
                const signalImages =
                  signal.images.length > 0
                    ? signal.images
                    : signal.leadImage
                    ? [{ url: signal.leadImage, name: signal.title }]
                    : [];
                const signalDocuments =
                  signal.documents.length > 0
                    ? signal.documents
                    : signal.document
                    ? [signal.document]
                    : [];
                const hasSignalVisual = Boolean(
                  resolveSignalVideo(signal.videoUrl) ||
                    signalImages.length > 0,
                );
                // A text-only card uses the space header so the row stays even.
                const cardImages =
                  signalImages.length > 0
                    ? signalImages
                    : !hasSignalVisual &&
                      signalDocuments.length === 0 &&
                      signal.spaceLeadImage
                    ? [
                        {
                          url: signal.spaceLeadImage,
                          name: signal.spaceTitle,
                        },
                      ]
                    : [];
                const hasMedia = Boolean(
                  hasSignalVisual ||
                    cardImages.length > 0 ||
                    signalDocuments.length > 0,
                );
                const signalHref = `/${lang}/dho/${signal.spaceSlug}/coherence?signal=${signal.slug}`;
                const dueLabel = signal.dueAt
                  ? formatSignalDueDateLabel(signal.dueAt)
                  : null;
                const overdue = signal.dueAt
                  ? isSignalDueOverdue(new Date(signal.dueAt))
                  : false;
                return (
                  <li key={signal.slug} className="flex">
                    <article
                      className={cn(
                        'exchange-card w-full cursor-pointer border bg-background',
                        chosen ? 'border-foreground' : 'border-border',
                      )}
                      onClick={() => setSelectedSlug(signal.slug)}
                    >
                      <ExchangeMedia
                        images={cardImages}
                        videoUrl={signal.videoUrl}
                        documents={signalDocuments}
                        alt={signal.title}
                        playLabel={t('fieldVideo')}
                      />
                      <div
                        className={cn(
                          'exchange-meta',
                          hasMedia
                            ? 'exchange-meta-media'
                            : 'exchange-meta-text',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <SignalTypeBadge
                            type={signal.type}
                            label={typeLabel(signal.type, t)}
                          />
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
                          className={cn(
                            'exchange-title font-medium leading-snug',
                            hasMedia
                              ? 'line-clamp-1 text-3'
                              : 'line-clamp-2 text-4',
                          )}
                          style={{
                            fontFamily: 'var(--font-family-heading)',
                          }}
                        >
                          <Link
                            href={signalHref}
                            className="hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {signal.title}
                          </Link>
                        </h2>
                        <SignalSpaceName name={signal.spaceTitle} />
                        <p className="flex min-w-0 items-center gap-1.5 text-1 text-neutral-11">
                          <span
                            className={cn(
                              PRIORITY_DOT_MARK_CLASS,
                              priorityDotClass(signal.priority),
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0 truncate">
                            {tSignals(`priorities.${signal.priority}`)}
                          </span>
                          {dueLabel ? (
                            <span
                              className={cn(
                                'shrink-0',
                                overdue && 'text-error-11',
                              )}
                            >
                              ·{' '}
                              {overdue
                                ? `${tSignals('filterDeadline_overdue')} · `
                                : ''}
                              {dueLabel}
                            </span>
                          ) : null}
                        </p>
                        {story ? (
                          <p
                            className={cn(
                              'text-2 leading-relaxed text-neutral-11',
                              hasMedia ? 'line-clamp-1' : 'line-clamp-3',
                            )}
                          >
                            {story}
                          </p>
                        ) : null}
                        {!hasMedia && impactCard ? (
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
                        ) : null}
                        {payout ? (
                          <p className="truncate font-mono text-2 text-foreground">
                            {payout}
                          </p>
                        ) : null}
                      </div>
                      <div className="exchange-footer">
                        <Button
                          type="button"
                          className="exchange-cta-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            setFundSpace({
                              slug: signal.spaceSlug,
                              title: signal.spaceTitle,
                            });
                          }}
                        >
                          {t('resource')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          colorVariant="neutral"
                          className="exchange-cta-secondary"
                          disabled={opening || !signal.spaceSlug}
                          onClick={(event) => {
                            event.stopPropagation();
                            openRoom(signal);
                          }}
                        >
                          {t('connect')}
                        </Button>
                        <Link
                          href={getDhoPathOverview(lang, signal.spaceSlug)}
                          className="exchange-cta-visit"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {t('visit')}
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        </Link>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <aside
          className={cn(NETWORK_RIGHT_PANEL_CLASS, open && '@4xl:!hidden')}
        >
          <NetworkExchangeShareCard
            lang={lang}
            type={types.length === 1 ? types[0] ?? null : null}
            preferredSlug={selected?.spaceSlug}
          />
        </aside>
      </div>
      <Dialog
        open={fundSpace != null}
        onOpenChange={(next) => {
          if (!next) setFundSpace(null);
        }}
      >
        <DialogContent
          overlayClassName={FUND_SPACE_DIALOG_OVERLAY_CLASS}
          className={FUND_SPACE_DIALOG_CONTENT_CLASS}
        >
          <DialogTitle className="sr-only">
            {tWallet('shortcuts.fundSpace')}
          </DialogTitle>
          {fundSpace ? (
            <FundASpaceFlow
              initialSpaceSlug={fundSpace.slug}
              initialSpaceTitle={fundSpace.title}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
