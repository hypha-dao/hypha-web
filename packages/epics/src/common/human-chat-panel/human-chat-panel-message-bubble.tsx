'use client';

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import type { TranslationValues } from 'next-intl';
import {
  Smile,
  SmilePlus,
  X,
  Pencil,
  Reply,
  FileIcon,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Play,
} from 'lucide-react';
import {
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  useMatrix,
  usePersonBySub,
  useUserPrivyIdByMatrixId,
} from '@hypha-platform/core/client';
import { PersonAvatar } from '../../people/components/person-avatar';

import { HumanChatPanelEmojiPicker } from './human-chat-panel-emoji-picker';
import {
  HumanChatPanelMessageOverflow,
  pushRecentChatReaction,
} from './human-chat-panel-message-overflow';
import { ChatMessageRichText } from './parse-simple-matrix-html';
import {
  type ChatPanelAttachmentMedia,
  isChatPanelAudioFile,
  isChatPanelVideoFile,
} from './chat-panel-media-types';
import {
  ChatVoiceAudioRow,
  formatVoiceDurationLabel,
} from './human-chat-panel-voice-audio-row';

type Reaction = {
  emoji: string;
  count: number;
  includesCurrentUser?: boolean;
  reactorUserIds?: string[];
};

type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: string; [k: string]: unknown };

/** Discord-style: dimmed media + centered pill (not full-width text strip). */
function TimelineSpoilerRevealOverlay({
  t,
  onReveal,
}: {
  t: (key: string) => string;
  onReveal: () => void;
}) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-muted/90 backdrop-blur-sm"
        aria-hidden
      />
      <div className="absolute inset-0 z-[2] flex items-center justify-center p-3">
        <button
          type="button"
          onClick={onReveal}
          aria-label={t('spoilerTapToReveal')}
          title={t('spoilerTapToReveal')}
          className="pointer-events-auto rounded-full bg-foreground px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-background shadow-md ring-1 ring-black/10 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:ring-white/15"
        >
          {t('draftSpoilerTag')}
        </button>
      </div>
    </>
  );
}

/**
 * Some homeservers reject `/_matrix/media/v3/thumbnail` for certain PNGs while
 * `.../download` works. Try thumbnail first, then full download, then icon.
 *
 * **Collage mode:** skip the thumbnail URL entirely — a grid of N tiles would
 * otherwise issue 2N concurrent media requests (thumb + fallback) and strict
 * homeservers return 429; download-only halves load and retries help transients.
 */
function MatrixTimelineImage({
  previewUrl,
  downloadUrl,
  alt,
  className,
  skipThumbnail = false,
  errorRetries = 0,
}: {
  previewUrl: string;
  downloadUrl: string;
  alt: string;
  className?: string;
  skipThumbnail?: boolean;
  /** Extra full-URL load attempts after thumb→full already failed (429, etc.). */
  errorRetries?: number;
}) {
  const [stage, setStage] = useState<'thumb' | 'full' | 'fail'>(() =>
    skipThumbnail ? 'full' : 'thumb',
  );
  const [retryAttempt, setRetryAttempt] = useState(0);

  if (stage === 'fail') {
    return (
      <div
        className={cn(
          'flex min-h-[120px] w-full items-center justify-center gap-2 bg-muted/50 text-muted-foreground',
          className,
        )}
      >
        <ImageIcon className="h-8 w-8 shrink-0 opacity-70" strokeWidth={1.25} />
        <span className="truncate px-2 text-xs">{alt}</span>
      </div>
    );
  }

  const src = stage === 'thumb' ? previewUrl : downloadUrl;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Matrix MXC HTTP URL
    <img
      key={`${stage}-${retryAttempt}`}
      src={src}
      alt={alt}
      className={className}
      loading={skipThumbnail ? 'lazy' : undefined}
      onError={() => {
        if (stage === 'thumb' && downloadUrl !== previewUrl) {
          setStage('full');
          return;
        }
        if (errorRetries > 0 && retryAttempt < errorRetries) {
          const next = retryAttempt + 1;
          window.setTimeout(() => {
            setRetryAttempt(next);
          }, 350 * next);
          return;
        }
        setStage('fail');
      }}
    />
  );
}

type MatrixClientLike = NonNullable<ReturnType<typeof useMatrix>['client']>;

function useMxcUrls(
  client: MatrixClientLike | null,
  mxc: string | undefined,
): { preview: string | null; download: string | null } {
  return useMemo(() => {
    if (!mxc || !client || !mxc.startsWith('mxc://')) {
      return { preview: null, download: null };
    }
    const download =
      client.mxcUrlToHttp(
        mxc,
        undefined,
        undefined,
        undefined,
        true,
        false,
        false,
      ) ?? null;
    const preview =
      client.mxcUrlToHttp(mxc, 800, 600, 'scale', true, false, false) ?? null;
    return { preview, download };
  }, [client, mxc]);
}

/** Single-image timeline row: preserve intrinsic aspect when known. */
function TimelineImageSlot({
  media,
  tOpen,
}: {
  media: ChatPanelAttachmentMedia;
  tOpen: (key: string) => string;
}) {
  const { client } = useMatrix();
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const { preview: mediaPreviewUrl, download: mediaDownloadUrl } = useMxcUrls(
    client,
    media.mxcUrl,
  );

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30"
      style={
        media.mediaInfo?.w &&
        media.mediaInfo?.h &&
        media.mediaInfo.w > 0 &&
        media.mediaInfo.h > 0
          ? { aspectRatio: `${media.mediaInfo.w} / ${media.mediaInfo.h}` }
          : { width: 'min(200px, 72vw)', minHeight: '120px' }
      }
    >
      {mediaPreviewUrl && mediaDownloadUrl ? (
        <>
          <a
            href={mediaDownloadUrl}
            target="_blank"
            rel="noreferrer noopener"
            tabIndex={media.spoiler && !spoilerRevealed ? -1 : 0}
            aria-hidden={media.spoiler && !spoilerRevealed}
            onKeyDown={(e) => {
              if (
                media.spoiler &&
                !spoilerRevealed &&
                (e.key === 'Enter' || e.key === ' ')
              ) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            className={cn(
              'block h-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              media.spoiler && !spoilerRevealed && 'pointer-events-none',
            )}
            aria-label={tOpen('openAttachmentInNewTab')}
            title={tOpen('openAttachmentInNewTab')}
          >
            <MatrixTimelineImage
              previewUrl={mediaPreviewUrl}
              downloadUrl={mediaDownloadUrl}
              alt={media.filename ?? ''}
              className={cn(
                'h-full max-h-72 w-full object-contain',
                media.spoiler && !spoilerRevealed && 'blur-2xl',
              )}
            />
          </a>
          {media.spoiler && !spoilerRevealed && (
            <TimelineSpoilerRevealOverlay
              t={tOpen}
              onReveal={() => setSpoilerRevealed(true)}
            />
          )}
        </>
      ) : (
        <p className="p-3 text-sm text-muted-foreground">
          {media.filename ?? tOpen('attachmentUnavailable')}
        </p>
      )}
    </div>
  );
}

/** Square tile in a multi-attach collage (Discord-style crop). */
function TimelineCollageImageTile({
  media,
  tOpen,
}: {
  media: ChatPanelAttachmentMedia;
  tOpen: (key: string) => string;
}) {
  const { client } = useMatrix();
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const { preview: mediaPreviewUrl, download: mediaDownloadUrl } = useMxcUrls(
    client,
    media.mxcUrl,
  );

  return (
    <div className="relative aspect-square min-h-0 min-w-0 overflow-hidden rounded-md bg-muted/40">
      {mediaPreviewUrl && mediaDownloadUrl ? (
        <>
          <a
            href={mediaDownloadUrl}
            target="_blank"
            rel="noreferrer noopener"
            tabIndex={media.spoiler && !spoilerRevealed ? -1 : 0}
            aria-hidden={media.spoiler && !spoilerRevealed}
            onKeyDown={(e) => {
              if (
                media.spoiler &&
                !spoilerRevealed &&
                (e.key === 'Enter' || e.key === ' ')
              ) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            className={cn(
              'block h-full w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              media.spoiler && !spoilerRevealed && 'pointer-events-none',
            )}
            aria-label={tOpen('openAttachmentInNewTab')}
            title={tOpen('openAttachmentInNewTab')}
          >
            <MatrixTimelineImage
              previewUrl={mediaPreviewUrl}
              downloadUrl={mediaDownloadUrl}
              alt={media.filename ?? ''}
              className={cn(
                'h-full w-full object-cover',
                media.spoiler && !spoilerRevealed && 'blur-2xl',
              )}
              skipThumbnail
              errorRetries={2}
            />
          </a>
          {media.spoiler && !spoilerRevealed && (
            <TimelineSpoilerRevealOverlay
              t={tOpen}
              onReveal={() => setSpoilerRevealed(true)}
            />
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
          {media.filename ?? tOpen('attachmentUnavailable')}
        </div>
      )}
    </div>
  );
}

function bundleImageGridClass(imageCount: number): string {
  if (imageCount <= 1) return 'grid-cols-1';
  if (imageCount === 2) return 'grid-cols-2';
  if (imageCount === 4) return 'grid-cols-2';
  return 'grid-cols-3';
}

function partitionBundleSlots(slots: ChatPanelAttachmentMedia[]) {
  const images = slots.filter((s) => s.msgtype === 'm.image');
  const files = slots.filter(
    (s) => s.msgtype === 'm.file' || s.msgtype === 'm.audio',
  );
  const audios = files.filter((s) => isChatPanelAudioFile(s));
  const videos = files.filter(
    (s) => !isChatPanelAudioFile(s) && isChatPanelVideoFile(s),
  );
  const otherFiles = files.filter(
    (s) => !isChatPanelAudioFile(s) && !isChatPanelVideoFile(s),
  );
  return { images, audios, videos, otherFiles };
}

/** Telegram-style voice / audio row with working play (native audio, not video chrome). */
function TimelineVoiceSlot({
  media,
  t,
}: {
  media: ChatPanelAttachmentMedia;
  t: (key: string) => string;
}) {
  const { client } = useMatrix();
  const { download: src } = useMxcUrls(client, media.mxcUrl);
  const durationMs = media.mediaInfo?.duration;
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  const durationLabel = formatVoiceDurationLabel(
    durationMs,
    t('voiceMessageShort'),
  );

  const voiceLabel = /^voice-message-\d+\.[^.]+$/i.test(media.filename ?? '')
    ? t('voiceMessage')
    : media.filename ?? t('voiceMessage');

  if (!src) {
    return (
      <p className="p-2 text-xs text-muted-foreground">
        {media.filename ?? t('attachmentUnavailable')}
      </p>
    );
  }

  const spoilerActive = Boolean(media.spoiler && !spoilerRevealed);

  return (
    <div
      className="relative mt-1 overflow-hidden rounded-[9999px]"
      data-testid="chat-message-media-audio"
    >
      <ChatVoiceAudioRow
        audioSrc={src}
        durationLabel={durationLabel}
        voiceLabel={voiceLabel}
        variant="timeline"
        spoilerPreview={spoilerActive}
      />
      {spoilerActive && (
        <TimelineSpoilerRevealOverlay
          t={t}
          onReveal={() => setSpoilerRevealed(true)}
        />
      )}
    </div>
  );
}

/** Inline Matrix video (`m.file` + video/*): poster frame + large play, then native controls while playing. */
function TimelineMatrixVideo({
  media,
  t,
}: {
  media: ChatPanelAttachmentMedia;
  t: (key: string) => string;
}) {
  const { client } = useMatrix();
  const { download: src } = useMxcUrls(client, media.mxcUrl);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const knownAspect =
    media.mediaInfo?.w &&
    media.mediaInfo?.h &&
    media.mediaInfo.w > 0 &&
    media.mediaInfo.h > 0
      ? `${media.mediaInfo.w} / ${media.mediaInfo.h}`
      : null;

  if (!src) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        {media.filename ?? t('attachmentUnavailable')}
      </p>
    );
  }

  const spoilerActive = media.spoiler && !spoilerRevealed;
  const showYoutubeChrome = !spoilerActive && !playing;

  return (
    <div
      className="relative mt-1 w-full max-w-md overflow-hidden rounded-lg border border-border bg-black shadow-md"
      data-testid="chat-message-media-video"
    >
      <div
        className={cn(
          'relative w-full overflow-hidden bg-black',
          knownAspect ? '' : 'aspect-video max-h-72',
        )}
        style={knownAspect ? { aspectRatio: knownAspect } : undefined}
      >
        <video
          ref={videoRef}
          key={src}
          src={src}
          playsInline
          preload="metadata"
          muted={muted}
          controls={playing && !spoilerActive}
          aria-label={media.filename ?? t('attachment')}
          className={cn(
            'h-full w-full object-contain',
            spoilerActive && 'pointer-events-none blur-2xl',
          )}
          onLoadedMetadata={() => {
            const el = videoRef.current;
            if (!el || spoilerActive) return;
            try {
              if (el.readyState >= 1 && el.currentTime === 0) {
                el.currentTime = 0.001;
              }
            } catch (e) {
              if (process.env.NODE_ENV === 'development') {
                console.debug('[TimelineMatrixVideo] seek failed:', e);
              }
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setMuted(true);
          }}
          onVolumeChange={() => {
            const el = videoRef.current;
            if (el) setMuted(el.muted);
          }}
        />
        {spoilerActive && (
          <TimelineSpoilerRevealOverlay
            t={t}
            onReveal={() => setSpoilerRevealed(true)}
          />
        )}
        {showYoutubeChrome && (
          <>
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/50"
              aria-hidden
            />
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[5] px-3 pb-2 pt-8">
              <p className="truncate text-left text-xs font-medium text-white drop-shadow-sm">
                {media.filename ?? t('attachment')}
              </p>
            </div>
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <button
                type="button"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-lg ring-1 ring-white/20 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:ring-white/15"
                aria-label={t('videoPreviewPlay')}
                title={t('videoPreviewPlay')}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const el = videoRef.current;
                  if (!el) return;
                  el.muted = true;
                  setMuted(true);
                  void el.play().catch(() => {});
                }}
              >
                <Play
                  className="ml-1 h-7 w-7"
                  fill="currentColor"
                  aria-hidden
                />
              </button>
            </div>
          </>
        )}
      </div>
      {playing && (
        <div className="flex items-center justify-between gap-2 border-t border-border/40 bg-card/95 px-2 py-1">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {media.filename ?? t('attachment')}
          </p>
          <button
            type="button"
            className="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-primary hover:underline"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              el.muted = !el.muted;
              setMuted(el.muted);
            }}
          >
            {muted ? t('videoUnmute') : t('videoMute')}
          </button>
        </div>
      )}
    </div>
  );
}

function TimelineFileSlot({
  media,
  t,
  format,
  fullWidth = false,
}: {
  media: ChatPanelAttachmentMedia;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  format: ReturnType<typeof useFormatter>;
  /** Use under a collage so the row spans the bundle width. */
  fullWidth?: boolean;
}) {
  const { client } = useMatrix();
  const { download: mediaDownloadUrl } = useMxcUrls(client, media.mxcUrl);

  const sizeLabel = useMemo(() => {
    const size = media.mediaInfo?.size;
    if (size == null) return null;
    if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
      return t('attachmentSizeUnknown');
    }
    if (size < 1024) {
      return format.number(size, {
        style: 'unit',
        unit: 'byte',
        unitDisplay: 'narrow',
        maximumFractionDigits: 0,
      });
    }
    if (size < 1024 * 1024) {
      return format.number(size / 1024, {
        style: 'unit',
        unit: 'kilobyte',
        unitDisplay: 'narrow',
        maximumFractionDigits: 1,
      });
    }
    return format.number(size / (1024 * 1024), {
      style: 'unit',
      unit: 'megabyte',
      unitDisplay: 'narrow',
      maximumFractionDigits: 1,
    });
  }, [media.mediaInfo?.size, format, t]);

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card px-3 py-2',
        fullWidth
          ? 'w-full min-w-0 max-w-none'
          : 'w-[min(240px,85vw)] shrink-0',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileIcon className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          {mediaDownloadUrl ? (
            <a
              href={mediaDownloadUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <span className="truncate">
                {media.filename ?? t('attachment')}
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </a>
          ) : (
            <span className="truncate text-sm font-medium text-foreground">
              {media.filename ?? t('attachment')}
            </span>
          )}
          {sizeLabel != null && (
            <p className="text-xs text-muted-foreground">{sizeLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}

type HumanChatPanelMessageBubbleProps = {
  /** Map Matrix user id to display name for reaction hover tooltips. */
  resolveReactionReactorLabel?: (userId: string) => string;
  /** Parent list ensures at most one message shows the floating action bar. */
  isActionBarVisible?: boolean;
  onRowPointerEnter?: () => void;
  onRowPointerLeave?: () => void;
  /** Notify when the hover-bar emoji picker opens/closes (parent may lock visibility). */
  onHoverReactPickerOpenChange?: (open: boolean) => void;
  /** Active Matrix room (for message link + overflow). */
  roomId?: string | null;
  /** Logged-in Matrix user id (delete permission + recent reactions). */
  currentUserId?: string | null;
  /** Profile URL for current user (reply header when quoting self). */
  currentUserAvatarUrl?: string | null;
  message: {
    id: string;
    role: 'user' | 'member';
    isSynthetic?: boolean;
    parts?: UIMessagePart[];
    senderName?: string;
    /** Author MXID when known (overflow delete). */
    senderMatrixId?: string;
    avatarUrl?: string;
    timestamp?: Date;
    reactions?: Reaction[];
    /** Matrix formatted_body (subset) for rich display */
    formattedContentHtml?: string;
    media?: ChatPanelAttachmentMedia;
    mediaSlots?: ChatPanelAttachmentMedia[];
    sendPending?: {
      attachmentCount: number;
      captionPreview: string;
      uploadedCount?: number;
    };
    /** Rich reply: quoted context above the new text */
    replyTo?: {
      authorLabel: string;
      /** When omitted, UI shows “original unavailable” */
      excerpt?: string;
      sourceUserId?: string;
      authorAvatarUrl?: string;
    };
    /** Matrix `m.mentions.user_ids` when present on the event. */
    mentionedUserIds?: string[];
  };
  isStreaming?: boolean;
  /** When set, Reply is enabled (omit for synthetic messages like welcome). */
  onReply?: () => void;
  /** When set, Edit is enabled (own text messages only; parent omits otherwise). */
  onEdit?: () => void;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  /** When set, user can open react picker (omit for welcome). */
  onReact?: (emoji: string) => void | Promise<void>;
  /** Cancel in-flight attachment send (pending row only). */
  onCancelSendPending?: () => void;
  /** Timeline chrome: first unread row (Discord-style emphasis). */
  unreadBoundary?: boolean;
};

const MAX_VISIBLE_REACTIONS = 12;

/** Discord-style jumbo emoji: cap so huge sticker-style spam stays readable. */
const MAX_JUMBO_EMOJI_COUNT = 27;

/**
 * Split a string into user-perceived grapheme clusters (ZWJ sequences stay together).
 */
function splitGraphemeClusters(s: string): string[] {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s),
      ({ segment }) => segment,
    );
  }
  const out: string[] = [];
  const re =
    /\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*/gu;
  let i = 0;
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (m && m.index === i) {
      out.push(m[0]);
      i = re.lastIndex;
      continue;
    }
    const cp = s.codePointAt(i)!;
    const w = cp > 0xffff ? 2 : 1;
    out.push(s.slice(i, i + w));
    i += w;
  }
  return out;
}

const EMOJI_GRAPHEME_RE =
  /^(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)$/u;

/** e.g. 🇺🇸 — not matched by Extended_Pictographic alone */
const FLAG_CLUSTER_RE = /^\p{Regional_Indicator}{2}$/u;

function isEmojiGrapheme(g: string): boolean {
  const t = g.trim();
  if (!t) return false;
  return EMOJI_GRAPHEME_RE.test(t) || FLAG_CLUSTER_RE.test(t);
}

/**
 * When the body is only emoji (optional whitespace), render large “jumboji” like Discord.
 * Disabled for rich replies and @mentions so context stays readable.
 */
function getEmojiOnlyJumboLayout(
  raw: string,
  hasReply: boolean,
):
  | { mode: 'normal' }
  | { mode: 'jumbo'; graphemes: string[]; sizeClass: string } {
  const trimmed = raw.trim();
  if (!trimmed || hasReply || /@\S/.test(trimmed)) {
    return { mode: 'normal' };
  }
  const condensed = trimmed.replace(/\s+/g, '');
  if (!condensed) {
    return { mode: 'normal' };
  }
  const graphemes = splitGraphemeClusters(condensed).filter(
    (g) => g.trim().length > 0,
  );
  if (graphemes.length === 0 || graphemes.length > MAX_JUMBO_EMOJI_COUNT) {
    return { mode: 'normal' };
  }
  if (!graphemes.every(isEmojiGrapheme)) {
    return { mode: 'normal' };
  }

  let sizeClass: string;
  if (graphemes.length === 1) {
    sizeClass = 'text-5xl leading-none gap-2';
  } else if (graphemes.length <= 5) {
    sizeClass = 'text-4xl leading-none gap-1';
  } else {
    sizeClass = 'text-3xl leading-none gap-1';
  }

  return { mode: 'jumbo', graphemes, sizeClass };
}

/**
 * Discord-style relative timestamp: browser locale + user's timezone (default).
 * Today: time only; yesterday: label + time; older: localized date + time.
 */
function formatTimestamp(
  date: Date,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfMessageDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfMessageDay.getTime()) /
      (24 * 60 * 60 * 1000),
  );

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (dayDiff === 0) {
    return t('timestampToday', { time: timeStr });
  }
  if (dayDiff === 1) {
    return t('timestampYesterday', { time: timeStr });
  }

  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
  return t('timestampDate', { date: dateStr, time: timeStr });
}

/**
 * Render text content with @mentions highlighted.
 */
function renderTextWithMentions(text: string): React.ReactNode[] {
  const mentionRegex = /@([\w\s]+?)(?=\s|$|[.,!?;:])/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="bg-primary/20 text-primary rounded px-1 font-medium"
      >
        @{match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

type ReplyConnectorGeometry = {
  width: number;
  height: number;
  d: string;
};

/**
 * L-shaped path in row-local px: vertical from main-avatar top-center to the reply-row
 * height, then horizontal toward the small avatar. Uses only `L` segments so the path
 * cannot degenerate like the previous quadratic branch when yRep ≪ yMainTop.
 */
function buildReplyConnectorPolylineD(params: {
  xMain: number;
  yMainTop: number;
  yRep: number;
  xEnd: number;
}): string {
  const { xMain, yMainTop, yRep, xEnd } = params;
  if (Math.abs(xEnd - xMain) < 0.75) {
    return `M ${xMain} ${yMainTop} L ${xMain} ${yRep}`;
  }
  return `M ${xMain} ${yMainTop} L ${xMain} ${yRep} L ${xEnd} ${yRep}`;
}

/**
 * Measured Discord-style connector: stem from **top-center** of main avatar, vertical to
 * reply row, rounded corner, horizontal ending just **left** of the small avatar.
 */
function ChatReplyConnectorMeasured({
  rowRef,
  replyAvatarRef,
  mainAvatarRef,
}: {
  rowRef: RefObject<HTMLDivElement | null>;
  replyAvatarRef: RefObject<HTMLDivElement | null>;
  mainAvatarRef: RefObject<HTMLDivElement | null>;
}) {
  const [geom, setGeom] = useState<ReplyConnectorGeometry | null>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const replyA = replyAvatarRef.current;
    const mainA = mainAvatarRef.current;
    if (!row || !replyA || !mainA) {
      setGeom(null);
      return;
    }

    const measure = () => {
      const rEl = rowRef.current;
      const rep = replyAvatarRef.current;
      const main = mainAvatarRef.current;
      if (!rEl || !rep || !main) {
        setGeom(null);
        return;
      }
      const rowRect = rEl.getBoundingClientRect();
      const repRect = rep.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const w = rowRect.width;
      const h = rowRect.height;
      if (w <= 0 || h <= 0) {
        setGeom(null);
        return;
      }
      const xMain = mainRect.left + mainRect.width / 2 - rowRect.left;
      const yRep = repRect.top - rowRect.top + repRect.height / 2;
      /** Stem starts at main avatar top-center (Discord-style). */
      const yMainTop =
        mainRect.top - rowRect.top + Math.min(4, mainRect.height * 0.06);
      const gapPx = 6;
      const smallLeft = repRect.left - rowRect.left;
      const smallRight = repRect.right - rowRect.left;
      const xEndTarget =
        smallLeft >= xMain ? smallLeft - gapPx : smallRight + gapPx;
      const xEnd =
        smallLeft >= xMain
          ? Math.min(xEndTarget, smallLeft - 2)
          : Math.max(xEndTarget, smallRight + 2);
      const d = buildReplyConnectorPolylineD({
        xMain,
        yMainTop,
        yRep,
        xEnd,
      });
      setGeom({ width: w, height: h, d });
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(row);
    ro.observe(replyA);
    ro.observe(mainA);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [rowRef, replyAvatarRef, mainAvatarRef]);

  if (!geom) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[8] overflow-visible text-muted-foreground/60 dark:text-muted-foreground/70"
      width={geom.width}
      height={geom.height}
      viewBox={`0 0 ${geom.width} ${geom.height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={geom.d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Matrix often exposes the raw localpart (e.g. `prev_privy_did_…`, `prod_privy_did_…`)
 * as displayname; resolve Hypha profile via matrix_user_links when the label still looks technical.
 */
function needsHyphaProfileForMatrixLabel(
  label: string | undefined,
  matrixId: string | undefined,
): boolean {
  if (!matrixId?.trim()) return false;
  const l = label?.trim() ?? '';
  if (!l) return true;
  if (l === matrixId) return true;
  if (/^prev_privy_/i.test(l)) return true;
  if (/^prod_privy_/i.test(l)) return true;
  /** Embedded Privy DID in localpart / displayname (prod vs stage prefixes). */
  if (/privy_did_privy/i.test(l)) return true;
  return false;
}

function formatPersonDisplayName(p: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
}): string {
  const full = [p.name, p.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (p.nickname?.trim()) return p.nickname.trim();
  return '';
}

function reactionTooltipText(
  reaction: Reaction,
  resolveLabel: (userId: string) => string,
  t: (key: string, values?: TranslationValues) => string,
): string | undefined {
  const ids = reaction.reactorUserIds;
  if (!ids?.length) return undefined;
  const names = ids.map((id) => resolveLabel(id));
  return t('reactionReactorsTooltip', {
    names: names.join(', '),
    emoji: reaction.emoji,
  });
}

export function HumanChatPanelMessageBubble({
  resolveReactionReactorLabel,
  isActionBarVisible = false,
  onRowPointerEnter,
  onRowPointerLeave,
  onHoverReactPickerOpenChange,
  message,
  isStreaming,
  roomId,
  currentUserId,
  currentUserAvatarUrl,
  onReply,
  onEdit,
  onDeleteMessage,
  onReact,
  onCancelSendPending,
  unreadBoundary = false,
}: HumanChatPanelMessageBubbleProps) {
  const t = useTranslations('HumanChatPanel');
  const format = useFormatter();
  const { client } = useMatrix();
  const [hoverReactPickerOpen, setHoverReactPickerOpen] = useState(false);
  const [inlineReactPickerOpen, setInlineReactPickerOpen] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  /**
   * Use **unauthenticated** v3 media URLs for `<img>` and `<a target="_blank">`.
   * Authenticated v1 URLs require `Authorization: Bearer` — browsers do not send that
   * for navigation or image loads, which yields `M_MISSING_TOKEN` on open.
   */
  const mediaDownloadUrl = useMemo(() => {
    const mxc = message.media?.mxcUrl;
    if (!mxc || !client) return null;
    return client.mxcUrlToHttp(
      mxc,
      undefined,
      undefined,
      undefined,
      true,
      false,
      false,
    );
  }, [client, message.media?.mxcUrl]);

  const mediaPreviewUrl = useMemo(() => {
    const mxc = message.media?.mxcUrl;
    if (!mxc || !client) return null;
    return client.mxcUrlToHttp(mxc, 800, 600, 'scale', true, false, false);
  }, [client, message.media?.mxcUrl]);

  // TODO: Handle non-text parts (file attachments, tool results, etc.)
  const textParts =
    message.parts?.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text',
    ) ?? [];
  const textContent = textParts.map((p) => p.text).join('');
  const replyTo = message.replyTo;
  const jumboLayout = textContent
    ? getEmojiOnlyJumboLayout(textContent, Boolean(replyTo))
    : { mode: 'normal' as const };

  const resolveSenderProfile =
    message.role === 'member' &&
    needsHyphaProfileForMatrixLabel(message.senderName, message.senderMatrixId);
  const resolveReplyProfile =
    replyTo?.sourceUserId != null &&
    needsHyphaProfileForMatrixLabel(replyTo.authorLabel, replyTo.sourceUserId);

  const { privyUserId: senderPrivySub, isLoading: isLoadingSenderLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId: resolveSenderProfile ? message.senderMatrixId : undefined,
    });
  const { privyUserId: replyPrivySub, isLoading: isLoadingReplyLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId: resolveReplyProfile ? replyTo?.sourceUserId : undefined,
    });

  const { person: senderPerson, isLoading: isLoadingSenderPerson } =
    usePersonBySub({ sub: senderPrivySub });
  const { person: replyPerson, isLoading: isLoadingReplyPerson } =
    usePersonBySub({ sub: replyPrivySub });

  const resolvedSenderName = useMemo(() => {
    if (message.role === 'user') {
      return message.senderName ?? t('you');
    }
    const fromPerson = senderPerson
      ? formatPersonDisplayName(senderPerson)
      : '';
    if (fromPerson) return fromPerson;
    return message.senderName ?? t('unknownMember');
  }, [message.role, message.senderName, senderPerson, t]);

  const resolvedReplyAuthorLabel = useMemo(() => {
    if (!replyTo) return '';
    const fromPerson = replyPerson ? formatPersonDisplayName(replyPerson) : '';
    if (fromPerson) return fromPerson;
    return replyTo.authorLabel;
  }, [replyPerson, replyTo]);

  const senderProfileLoading =
    resolveSenderProfile &&
    (isLoadingSenderLink ||
      isLoadingSenderPerson ||
      (Boolean(senderPrivySub) && !senderPerson));

  const replyProfileLoading =
    resolveReplyProfile &&
    (isLoadingReplyLink ||
      isLoadingReplyPerson ||
      (Boolean(replyPrivySub) && !replyPerson));

  const senderName = resolvedSenderName;
  const replyAuthorLabelForUi = replyTo ? resolvedReplyAuthorLabel : '';
  const mainAvatarSrc =
    message.role === 'member' && senderPerson?.avatarUrl
      ? senderPerson.avatarUrl
      : message.avatarUrl;
  const replyHeaderAvatarResolved =
    replyTo &&
    currentUserId &&
    replyTo.sourceUserId &&
    replyTo.sourceUserId === currentUserId
      ? currentUserAvatarUrl ?? replyTo.authorAvatarUrl
      : replyPerson?.avatarUrl ?? replyTo?.authorAvatarUrl;
  const timestamp = message.timestamp
    ? formatTimestamp(message.timestamp, t)
    : undefined;
  const reactions = message.reactions ?? [];
  const isSendPendingRow = Boolean(message.sendPending);
  const canReply = Boolean(onReply) && !isSendPendingRow;
  const canEdit = Boolean(onEdit) && !isSendPendingRow;
  const canReact = Boolean(onReact) && !isSendPendingRow;

  const sendPendingMainLabel = (() => {
    const sp = message.sendPending;
    if (!sp) return '';
    const { attachmentCount: n, uploadedCount: u } = sp;
    if (u != null && u > 0 && u < n) {
      return t('messageSendUploadProgress', { completed: u, total: n });
    }
    if (u != null && u >= n) {
      return t('messageSendFinishing');
    }
    return t('messageSendBuilding', { count: n });
  })();

  const sendPendingProgress = (() => {
    const sp = message.sendPending;
    if (!sp) return { pct: 0, indeterminate: false, showBar: false };
    const n = sp.attachmentCount;
    const u = sp.uploadedCount ?? 0;
    if (n <= 0) return { pct: 0, indeterminate: false, showBar: false };
    if (u >= n) return { pct: 100, indeterminate: false, showBar: true };
    if (u > 0)
      return {
        pct: Math.max(6, Math.round((u / n) * 100)),
        indeterminate: false,
        showBar: true,
      };
    return { pct: 18, indeterminate: true, showBar: true };
  })();
  const visibleReactions = reactions.slice(0, MAX_VISIBLE_REACTIONS);
  const hiddenReactionCount = Math.max(
    0,
    reactions.length - MAX_VISIBLE_REACTIONS,
  );

  const highlightMentionForViewer = Boolean(
    currentUserId &&
      message.mentionedUserIds?.length &&
      message.mentionedUserIds.includes(currentUserId),
  );

  const messageRowRef = useRef<HTMLDivElement>(null);
  const replyAvatarMeasureRef = useRef<HTMLDivElement>(null);
  const mainAvatarMeasureRef = useRef<HTMLDivElement>(null);

  const row = (moreSlot: ReactNode | null) => (
    <div
      ref={messageRowRef}
      data-matrix-event-id={message.id}
      data-testid="chat-message"
      className={cn(
        'group relative -mx-3 flex flex-col overflow-visible rounded-sm px-3 py-0.5 transition-colors',
        /* Discord-style row tint: hover (primary) + focus-within for keyboard/reactions */
        'hover:bg-muted/60 focus-within:bg-muted/60',
        highlightMentionForViewer &&
          'border-l-[3px] border-l-amber-500/95 bg-amber-100/85 dark:border-l-amber-400 dark:bg-amber-950/45',
        unreadBoundary &&
          !highlightMentionForViewer &&
          'border-l-[3px] border-l-amber-700/90 bg-amber-50/90 dark:border-l-amber-600 dark:bg-amber-950/35',
      )}
      onPointerEnter={onRowPointerEnter}
      onPointerLeave={onRowPointerLeave}
    >
      {replyTo && (
        <ChatReplyConnectorMeasured
          rowRef={messageRowRef}
          replyAvatarRef={replyAvatarMeasureRef}
          mainAvatarRef={mainAvatarMeasureRef}
        />
      )}
      {replyTo && (
        <div
          data-testid="chat-message-reply-context"
          className="relative z-[1] mb-1 flex min-h-[22px] items-center gap-1.5 pl-[52px]"
        >
          <div ref={replyAvatarMeasureRef} className="shrink-0">
            <PersonAvatar
              size="sm"
              shape="circle"
              avatarSrc={replyHeaderAvatarResolved}
              userName={replyAuthorLabelForUi}
              isLoading={replyProfileLoading}
            />
          </div>
          <p className="flex min-w-0 flex-1 items-baseline gap-1 truncate text-xs leading-tight text-muted-foreground">
            <span className="shrink-0 font-semibold text-muted-foreground">
              {replyAuthorLabelForUi.startsWith('@')
                ? replyAuthorLabelForUi
                : `@${replyAuthorLabelForUi}`}
            </span>
            {replyTo.excerpt != null && replyTo.excerpt !== '' ? (
              <span className="min-w-0 truncate font-normal">
                {replyTo.excerpt}
              </span>
            ) : (
              <span className="italic">{t('replyOriginalUnavailable')}</span>
            )}
          </p>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Main avatar: first row in this column is sender name — aligns with "You" */}
        <div
          className="relative z-[1] flex w-10 shrink-0 flex-col items-center pt-0.5"
          data-testid="chat-message-avatar"
        >
          <div ref={mainAvatarMeasureRef} className="relative">
            <PersonAvatar
              size="chat"
              shape="circle"
              avatarSrc={mainAvatarSrc}
              userName={senderName}
              isLoading={senderProfileLoading}
            />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
          {/* Name + Timestamp */}
          <div className="flex items-baseline gap-2">
            <Skeleton
              className="inline-block rounded"
              loading={senderProfileLoading}
              width={120}
              height={14}
            >
              <span className="font-semibold text-sm text-foreground">
                {senderName}
              </span>
            </Skeleton>
            {timestamp && (
              <span className="text-xs text-muted-foreground">{timestamp}</span>
            )}
          </div>

          {message.sendPending && (
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              data-testid="chat-message-send-pending"
              className="relative mt-1.5 max-w-md overflow-hidden rounded-xl border border-border bg-gradient-to-b from-card to-muted/30 shadow-sm"
            >
              {onCancelSendPending && (
                <button
                  type="button"
                  onClick={onCancelSendPending}
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={t('messageSendCancel')}
                  title={t('messageSendCancel')}
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              )}
              <div className="flex gap-3 px-4 py-3 pr-12">
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 dark:bg-primary/20"
                  aria-hidden
                >
                  <Loader2 className="h-[18px] w-[18px] animate-spin text-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {sendPendingMainLabel}
                    </p>
                    <span className="rounded-md bg-muted/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('messageSendFilesBadge', {
                        count: message.sendPending.attachmentCount,
                      })}
                    </span>
                  </div>
                  {sendPendingProgress.showBar && (
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted/90 dark:bg-muted/50"
                      aria-hidden
                    >
                      <div
                        className={cn(
                          'h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-[width] duration-500 ease-out',
                          sendPendingProgress.indeterminate && 'animate-pulse',
                        )}
                        style={{ width: `${sendPendingProgress.pct}%` }}
                      />
                    </div>
                  )}
                  {message.sendPending.captionPreview.trim() !== '' && (
                    <p className="line-clamp-2 border-t border-border/60 pt-2 text-xs leading-relaxed text-muted-foreground">
                      {message.sendPending.captionPreview.trim()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Message text above attachments (caption + media in one Matrix event) */}
          {textContent &&
            (message.formattedContentHtml ? (
              <p
                data-testid="chat-message-body"
                className={cn(
                  'text-sm leading-snug text-foreground',
                  message.media ||
                    (message.mediaSlots && message.mediaSlots.length > 0)
                    ? 'mt-1'
                    : 'mt-0',
                )}
              >
                <ChatMessageRichText html={message.formattedContentHtml} />
              </p>
            ) : jumboLayout.mode === 'jumbo' ? (
              <p
                data-testid="chat-message-body"
                className={cn(
                  'flex flex-wrap items-end text-foreground',
                  jumboLayout.sizeClass,
                  message.media ||
                    (message.mediaSlots && message.mediaSlots.length > 0)
                    ? 'mt-1'
                    : 'mt-0',
                )}
                aria-label={textContent.trim()}
              >
                {jumboLayout.graphemes.map((g, i) => (
                  <span key={`${g}-${i}`} aria-hidden>
                    {g}
                  </span>
                ))}
              </p>
            ) : (
              <p
                data-testid="chat-message-body"
                className={cn(
                  'text-sm leading-snug text-foreground',
                  message.media ||
                    (message.mediaSlots && message.mediaSlots.length > 0)
                    ? 'mt-1'
                    : 'mt-0',
                )}
              >
                {renderTextWithMentions(textContent)}
              </p>
            ))}

          {message.mediaSlots && message.mediaSlots.length > 1 && (
            <div
              className="mt-1 max-w-md space-y-2"
              data-testid="chat-message-media-bundle"
            >
              {(() => {
                const { images, audios, videos, otherFiles } =
                  partitionBundleSlots(message.mediaSlots);
                const gridClass = bundleImageGridClass(images.length);
                return (
                  <>
                    {images.length > 0 && (
                      <div
                        className={cn(
                          'grid auto-rows-[minmax(0,1fr)] gap-0.5 overflow-hidden rounded-lg border border-border bg-muted/20 p-0.5',
                          gridClass,
                        )}
                      >
                        {images.map((slot, idx) => (
                          <TimelineCollageImageTile
                            key={`${message.id}-img-${idx}`}
                            media={slot}
                            tOpen={t}
                          />
                        ))}
                      </div>
                    )}
                    {audios.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {audios.map((slot, idx) => (
                          <TimelineVoiceSlot
                            key={`${message.id}-aud-${idx}`}
                            media={slot}
                            t={t}
                          />
                        ))}
                      </div>
                    )}
                    {videos.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {videos.map((slot, idx) => (
                          <TimelineMatrixVideo
                            key={`${message.id}-vid-${idx}`}
                            media={slot}
                            t={t}
                          />
                        ))}
                      </div>
                    )}
                    {otherFiles.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {otherFiles.map((slot, idx) => (
                          <TimelineFileSlot
                            key={`${message.id}-file-${idx}`}
                            media={slot}
                            t={t}
                            format={format}
                            fullWidth
                          />
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {!message.mediaSlots?.length &&
            message.media &&
            message.media.msgtype === 'm.image' && (
              <div
                className="relative mt-1 max-w-md overflow-hidden rounded-lg border border-border bg-muted/30"
                data-testid="chat-message-media-image"
                style={
                  message.media.mediaInfo?.w &&
                  message.media.mediaInfo?.h &&
                  message.media.mediaInfo.w > 0 &&
                  message.media.mediaInfo.h > 0
                    ? {
                        aspectRatio: `${message.media.mediaInfo.w} / ${message.media.mediaInfo.h}`,
                      }
                    : undefined
                }
              >
                {mediaPreviewUrl && mediaDownloadUrl ? (
                  <>
                    <a
                      href={mediaDownloadUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      tabIndex={
                        message.media.spoiler && !spoilerRevealed ? -1 : 0
                      }
                      aria-hidden={message.media.spoiler && !spoilerRevealed}
                      onKeyDown={(e) => {
                        const m = message.media;
                        if (
                          m?.spoiler &&
                          !spoilerRevealed &&
                          (e.key === 'Enter' || e.key === ' ')
                        ) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      className={cn(
                        'block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                        message.media.spoiler &&
                          !spoilerRevealed &&
                          'pointer-events-none',
                      )}
                      aria-label={t('openAttachmentInNewTab')}
                      title={t('openAttachmentInNewTab')}
                    >
                      <MatrixTimelineImage
                        key={message.id}
                        previewUrl={mediaPreviewUrl}
                        downloadUrl={mediaDownloadUrl}
                        alt={message.media.filename ?? ''}
                        className={cn(
                          'max-h-72 w-full object-contain',
                          message.media.spoiler &&
                            !spoilerRevealed &&
                            'blur-2xl',
                        )}
                      />
                    </a>
                    {message.media.spoiler && !spoilerRevealed && (
                      <TimelineSpoilerRevealOverlay
                        t={t}
                        onReveal={() => setSpoilerRevealed(true)}
                      />
                    )}
                  </>
                ) : (
                  <p className="p-3 text-sm text-muted-foreground">
                    {message.media.filename ?? t('attachmentUnavailable')}
                  </p>
                )}
              </div>
            )}

          {!message.mediaSlots?.length &&
            message.media &&
            isChatPanelAudioFile(message.media) && (
              <TimelineVoiceSlot media={message.media} t={t} />
            )}

          {!message.mediaSlots?.length &&
            message.media &&
            message.media.msgtype === 'm.file' &&
            isChatPanelVideoFile(message.media) && (
              <TimelineMatrixVideo media={message.media} t={t} />
            )}

          {!message.mediaSlots?.length &&
            message.media &&
            message.media.msgtype === 'm.file' &&
            !isChatPanelVideoFile(message.media) &&
            !isChatPanelAudioFile(message.media) && (
              <div
                className="mt-1 max-w-md rounded-lg border border-border bg-card px-3 py-2"
                data-testid="chat-message-media-file"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FileIcon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {mediaDownloadUrl ? (
                      <a
                        href={mediaDownloadUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        <span className="truncate">
                          {message.media.filename ?? t('attachment')}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      </a>
                    ) : (
                      <span className="truncate text-sm font-medium text-foreground">
                        {message.media.filename ?? t('attachment')}
                      </span>
                    )}
                    {message.media.mediaInfo?.size != null && (
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const size = message.media.mediaInfo.size;
                          if (
                            typeof size !== 'number' ||
                            !Number.isFinite(size) ||
                            size < 0
                          ) {
                            return t('attachmentSizeUnknown');
                          }
                          if (size < 1024) {
                            return format.number(size, {
                              style: 'unit',
                              unit: 'byte',
                              unitDisplay: 'narrow',
                              maximumFractionDigits: 0,
                            });
                          }
                          if (size < 1024 * 1024) {
                            return format.number(size / 1024, {
                              style: 'unit',
                              unit: 'kilobyte',
                              unitDisplay: 'narrow',
                              maximumFractionDigits: 1,
                            });
                          }
                          return format.number(size / (1024 * 1024), {
                            style: 'unit',
                            unit: 'megabyte',
                            unitDisplay: 'narrow',
                            maximumFractionDigits: 1,
                          });
                        })()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

          {/* Streaming indicator */}
          {isStreaming && (
            <span className="mt-1 inline-flex items-center gap-0.5">
              <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
              <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" />
              <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" />
            </span>
          )}

          {/* Reactions — Discord-style pills; inline add-reaction only when ≥1 reaction exists */}
          {visibleReactions.length > 0 && (
            <div
              data-testid="chat-message-reactions"
              className="mt-1 flex flex-wrap items-center gap-0.5"
            >
              {visibleReactions.map((reaction) => {
                const tooltip =
                  resolveReactionReactorLabel &&
                  reactionTooltipText(reaction, resolveReactionReactorLabel, t);
                const pill = (
                  <button
                    type="button"
                    disabled={!canReact}
                    aria-pressed={Boolean(reaction.includesCurrentUser)}
                    onClick={() => {
                      if (canReact && onReact) {
                        void onReact(reaction.emoji);
                      }
                    }}
                    className={cn(
                      /* Discord: rounded rectangle frame, not a full pill */
                      'inline-flex h-5 min-w-0 shrink-0 items-center gap-0.5 rounded-md border px-1.5 text-xs tabular-nums leading-none transition-colors',
                      reaction.includesCurrentUser
                        ? 'border-[#5865f2]/50 bg-[#5865f2]/15 hover:bg-[#5865f2]/20 dark:border-[#5865f2]/40 dark:bg-[#5865f2]/20'
                        : 'border-border bg-muted/80 hover:bg-muted',
                      canReact ? 'cursor-pointer' : 'cursor-default opacity-80',
                    )}
                  >
                    <span className="text-[13px] leading-none" aria-hidden>
                      {reaction.emoji}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-medium leading-none',
                        reaction.includesCurrentUser
                          ? 'text-[#5865f2] dark:text-[#949cf7]'
                          : 'text-muted-foreground',
                      )}
                    >
                      {reaction.count}
                    </span>
                  </button>
                );

                if (tooltip) {
                  return (
                    <Tooltip key={reaction.emoji} delayDuration={300}>
                      <TooltipTrigger asChild>{pill}</TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-xs text-left text-xs leading-snug"
                      >
                        {tooltip}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return <Fragment key={reaction.emoji}>{pill}</Fragment>;
              })}
              {hiddenReactionCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t('reactionsOverflow', { count: hiddenReactionCount })}
                </span>
              )}
              {canReact && onReact && (
                <HumanChatPanelEmojiPicker
                  open={inlineReactPickerOpen}
                  onOpenChange={setInlineReactPickerOpen}
                  onEmojiSelect={(native) => {
                    pushRecentChatReaction(native);
                    void onReact(native);
                  }}
                  ariaLabel={t('addReactionButton')}
                  align="start"
                >
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border',
                      'bg-muted/80 text-muted-foreground transition-colors hover:bg-muted',
                    )}
                    aria-label={t('addReactionButton')}
                    aria-expanded={inlineReactPickerOpen}
                  >
                    <SmilePlus className="h-3 w-3" strokeWidth={2} />
                  </button>
                </HumanChatPanelEmojiPicker>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Discord-style floating bar: compact height, tight to icon row */}
      <div
        className={cn(
          'absolute right-3 z-10 flex h-6 -translate-y-1/2 items-center gap-0 rounded-md border border-border bg-popover px-0 py-0 leading-none text-popover-foreground shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-opacity duration-150',
          replyTo ? 'top-[calc(1.375rem+0.25rem)]' : 'top-0',
          isActionBarVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!isActionBarVisible}
      >
        <HumanChatPanelEmojiPicker
          open={hoverReactPickerOpen}
          onOpenChange={(open) => {
            setHoverReactPickerOpen(open);
            onHoverReactPickerOpenChange?.(open);
          }}
          onEmojiSelect={(native) => {
            if (onReact) {
              pushRecentChatReaction(native);
              void onReact(native);
            }
          }}
          ariaLabel={t('emojiPickerReactToMessage')}
          align="end"
        >
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:block"
            aria-label={t('reactButton')}
            disabled={!canReact}
            aria-disabled={!canReact}
            aria-expanded={hoverReactPickerOpen}
          >
            <Smile className="h-3 w-3" strokeWidth={2} />
          </button>
        </HumanChatPanelEmojiPicker>
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:block"
          aria-label={t('editButton')}
          disabled={!canEdit}
          aria-disabled={!canEdit}
          onClick={onEdit}
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:block"
          aria-label={t('replyButton')}
          disabled={!canReply}
          aria-disabled={!canReply}
          onClick={onReply}
        >
          <Reply className="h-3 w-3" strokeWidth={2} />
        </button>
        {moreSlot}
      </div>
    </div>
  );

  if (message.isSynthetic) {
    return row(null);
  }

  return (
    <HumanChatPanelMessageOverflow
      roomId={roomId ?? null}
      messageId={message.id}
      disabled={false}
      canReact={canReact}
      onReact={onReact}
      onEdit={onEdit}
      onReply={onReply}
      menuCanEdit={canEdit}
      menuCanReply={canReply}
      onDeleteMessage={onDeleteMessage}
      currentUserId={currentUserId}
      senderMatrixId={message.senderMatrixId}
      message={{
        parts: message.parts,
        media: message.media,
        mediaSlots: message.mediaSlots,
      }}
    >
      {row}
    </HumanChatPanelMessageOverflow>
  );
}
