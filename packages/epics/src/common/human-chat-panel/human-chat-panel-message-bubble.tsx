'use client';

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  MATRIX_MXID_IN_PLAIN_TEXT,
  normalizePlainTextMxidCaptureFromMatch,
  useMatrix,
  usePersonBySub,
  useUserPrivyIdByMatrixId,
} from '@hypha-platform/core/client';
import { PersonAvatar } from '../../people/components/person-avatar';
import { APP_CHROME_SUBTLE_SQUARE_RADIUS } from '../chrome-radius';

import { HumanChatPanelEmojiPicker } from './human-chat-panel-emoji-picker';
import {
  HumanChatPanelMessageOverflow,
  pushRecentChatReaction,
} from './human-chat-panel-message-overflow';
import {
  hyphaDhoSlugFromUrl,
  isHyphaDhoChatMessageUrl,
} from './human-chat-message-link';
import { ChatMessageRichText } from './parse-simple-matrix-html';
import {
  matrixMemberDisplayLabelFromRoom,
  matrixUserIdToCanonicalPrivySub,
  needsHyphaProfileResolutionForMatrixLabel,
  pickUserVisibleMemberLabel,
} from './matrix-room-member-display';
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

/** Soft darken so inline photos blend with dark chat chrome (design reference). */
function ChatMediaAmbientOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] bg-black/15 shadow-[inset_0_0_40px_rgba(0,0,0,0.12)] dark:bg-black/35 dark:shadow-[inset_0_0_48px_rgba(0,0,0,0.28)]"
      aria-hidden
    />
  );
}

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
          {!(media.spoiler && !spoilerRevealed) && <ChatMediaAmbientOverlay />}
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
          {!(media.spoiler && !spoilerRevealed) && <ChatMediaAmbientOverlay />}
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
  /** Resolve `@localpart:homeserver` pills in message body (room member display names). */
  resolveMatrixMemberLabel?: (matrixUserId: string) => string;
  /**
   * Hypha roster / merged labels for timeline headers (sender + reply). When set,
   * used before `message.senderName` so senders match Members tab without requiring
   * `matrix_user_links` for every MXID.
   */
  resolveSenderDisplayLabel?: (matrixUserId: string | undefined) => string;
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

type ReplyConnectorGeometry = {
  width: number;
  height: number;
  d: string;
};

/** Rounded L-corner radius (px); keep small vs stem so the arc is visible. */
const REPLY_CONNECTOR_CORNER_R = 6;
/** Start the vertical stem slightly below the main avatar so the stroke does not sit on the tile image. */
const REPLY_CONNECTOR_MAIN_AVATAR_INSET = 3;

/**
 * L-shaped path in row-local px: vertical from below main avatar center, rounded elbow,
 * then horizontal to the small-avatar line. Rounded join avoids a harsh 90° kink; stem
 * starts under the main avatar to reduce visual overlap (layering: svg z-0, avatars z-1).
 */
function buildReplyConnectorPathD(params: {
  xMain: number;
  yStemStart: number;
  yRep: number;
  xEnd: number;
}): string {
  const { xMain, yStemStart, yRep, xEnd } = params;
  const r = REPLY_CONNECTOR_CORNER_R;

  if (Math.abs(xEnd - xMain) < 0.75) {
    return `M ${xMain} ${yStemStart} L ${xMain} ${yRep}`;
  }

  const goRight = xEnd > xMain;
  const yBefore = yRep - r;
  if (yStemStart >= yBefore - 0.5) {
    return `M ${xMain} ${yStemStart} L ${xMain} ${yRep} L ${xEnd} ${yRep}`;
  }
  if (goRight) {
    return `M ${xMain} ${yStemStart} L ${xMain} ${yBefore} A ${r} ${r} 0 0 1 ${
      xMain + r
    } ${yRep} L ${xEnd} ${yRep}`;
  }
  return `M ${xMain} ${yStemStart} L ${xMain} ${yBefore} A ${r} ${r} 0 0 0 ${
    xMain - r
  } ${yRep} L ${xEnd} ${yRep}`;
}

/**
 * Measured Discord-style connector: stem from main-avatar column (under the image),
 * up to the reply row with a **rounded** elbow, horizontal to just before the small avatar.
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
    let raf = 0;

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
      const mainBottomLocal = mainRect.bottom - rowRect.top;
      const r = REPLY_CONNECTOR_CORNER_R;
      /** Stem starts just under the main avatar (not from top) so the line does not cross the image. */
      const yStemStart = Math.max(
        mainRect.top - rowRect.top + mainRect.height * 0.35,
        Math.min(
          mainBottomLocal - REPLY_CONNECTOR_MAIN_AVATAR_INSET,
          yRep - r * 2 - 1,
        ),
      );
      const gapPx = 6;
      const smallLeft = repRect.left - rowRect.left;
      const smallRight = repRect.right - rowRect.left;
      const xEndTarget =
        smallLeft >= xMain ? smallLeft - gapPx : smallRight + gapPx;
      const xEnd =
        smallLeft >= xMain
          ? Math.min(xEndTarget, smallLeft - 2)
          : Math.max(xEndTarget, smallRight + 2);
      const d = buildReplyConnectorPathD({
        xMain,
        yStemStart,
        yRep,
        xEnd,
      });
      setGeom({ width: w, height: h, d });
    };

    const requestMeasure = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    const ro = new ResizeObserver(() => {
      requestMeasure();
    });
    const row = rowRef.current;
    const repAtMount = replyAvatarRef.current;
    const mainAtMount = mainAvatarRef.current;
    if (row) {
      ro.observe(row);
    }
    if (repAtMount) {
      ro.observe(repAtMount);
    }
    if (mainAtMount) {
      ro.observe(mainAtMount);
    }

    requestMeasure();
    const lateRefFrame = requestAnimationFrame(() => {
      const rep = replyAvatarRef.current;
      const main = mainAvatarRef.current;
      if (rep && repAtMount == null) {
        ro.observe(rep);
      }
      if (main && mainAtMount == null) {
        ro.observe(main);
      }
      requestMeasure();
    });
    window.addEventListener('resize', requestMeasure);
    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      cancelAnimationFrame(lateRefFrame);
      ro.disconnect();
      window.removeEventListener('resize', requestMeasure);
    };
  }, [rowRef, replyAvatarRef, mainAvatarRef]);

  if (!geom) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 overflow-visible text-border/80 dark:text-border/85"
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
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Matrix often exposes bridged localparts as displaynames (sometimes with a leading `@`).
 * Resolve Hypha profile via `matrix_user_links` when the label still looks technical.
 */
function needsHyphaProfileForMatrixLabel(
  label: string | undefined,
  matrixId: string | undefined,
): boolean {
  if (!matrixId?.trim()) return false;
  const l = label?.trim() ?? '';
  if (!l) return true;
  if (l === matrixId) return true;
  return needsHyphaProfileResolutionForMatrixLabel(label);
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

/**
 * Split plaintext into runs of literal text vs full Matrix MXIDs (`@local:homeserver`).
 * A naive `@(\w+)…` regex breaks on the colon inside bridged Privy locals — root cause of ugly pills.
 */
function splitPlainTextMatrixMentions(
  text: string,
): Array<{ kind: 'text'; value: string } | { kind: 'mxid'; full: string }> {
  const out: Array<
    { kind: 'text'; value: string } | { kind: 'mxid'; full: string }
  > = [];
  const re = new RegExp(MATRIX_MXID_IN_PLAIN_TEXT.source, 'g');
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const mid = normalizePlainTextMxidCaptureFromMatch(
      m[1] ?? '',
      text,
      m.index,
      m[0].length,
    );
    if (!mid) continue;
    const full = `@${mid}`;
    if (m.index > lastIndex) {
      out.push({ kind: 'text', value: text.slice(lastIndex, m.index) });
    }
    out.push({ kind: 'mxid', full });
    lastIndex = m.index + full.length;
  }
  if (lastIndex < text.length) {
    out.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  return out;
}

/**
 * Discord-like mention: inline pill that stays on the text baseline (no float above).
 */
function chatMentionPillClass(onViewerMentionTintRow: boolean): string {
  return cn(
    'mention-pill inline-block max-w-full align-baseline rounded px-1 py-0 text-[13px] font-medium leading-[inherit] whitespace-nowrap',
    onViewerMentionTintRow
      ? 'border border-accent-9/50 bg-background/95 text-foreground shadow-sm dark:border-accent-10/55 dark:bg-background/90'
      : 'border border-border/70 bg-muted/95 text-foreground shadow-sm dark:border-border/65 dark:bg-muted/90',
  );
}

/** Strip trailing punctuation — linear scan (avoid polynomial regex on user text). */
function trimTrailingUrlPunctuation(raw: string): string {
  let s = raw;
  /** `. , ; : ! ?` — safe to peel from the end of a pasted URL. */
  while (s.length > 0) {
    const ch = s[s.length - 1];
    if (
      ch === '.' ||
      ch === ',' ||
      ch === ';' ||
      ch === ':' ||
      ch === '!' ||
      ch === '?'
    ) {
      s = s.slice(0, -1);
      continue;
    }
    break;
  }
  /**
   * `)` / `]` / `}` — strip only *extra* closers (e.g. `…Foo))` ), not the
   * closing paren in `Function_(mathematics)` (opens > closes in prefix).
   */
  const stripExtraCloser = (
    openCh: '(' | '[' | '{',
    closeCh: ')' | ']' | '}',
  ) => {
    while (s.length > 0 && s[s.length - 1] === closeCh) {
      const prefix = s.slice(0, -1);
      let opens = 0;
      let closes = 0;
      for (let i = 0; i < prefix.length; i++) {
        const c = prefix[i];
        if (c === openCh) opens++;
        else if (c === closeCh) closes++;
      }
      if (opens > closes) break;
      s = prefix;
    }
  };
  stripExtraCloser('(', ')');
  stripExtraCloser('[', ']');
  stripExtraCloser('{', '}');
  return s;
}

function nextHttpSchemeIndex(text: string, from: number): number {
  const httpIdx = text.indexOf('http://', from);
  const httpsIdx = text.indexOf('https://', from);
  const hi = httpsIdx >= 0 ? httpsIdx : Number.POSITIVE_INFINITY;
  const lo = httpIdx >= 0 ? httpIdx : Number.POSITIVE_INFINITY;
  const start = Math.min(lo, hi);
  return Number.isFinite(start) ? start : -1;
}

type PlainUrlPiece =
  | { kind: 'text'; value: string }
  | { kind: 'url'; href: string; trailing: string };

function splitPlainTextUrls(text: string): PlainUrlPiece[] {
  const out: PlainUrlPiece[] = [];
  let last = 0;
  const n = text.length;
  while (last < n) {
    const start = nextHttpSchemeIndex(text, last);
    if (start < 0) {
      out.push({ kind: 'text', value: text.slice(last) });
      break;
    }
    if (start > last) {
      out.push({ kind: 'text', value: text.slice(last, start) });
    }
    const schemeLen = text.startsWith('https://', start) ? 8 : 7;
    let end = start + schemeLen;
    while (end < n) {
      const ch = text[end];
      if (
        ch === ' ' ||
        ch === '\t' ||
        ch === '\n' ||
        ch === '\r' ||
        ch === '<' ||
        ch === '>' ||
        ch === '"' ||
        ch === "'"
      ) {
        break;
      }
      end++;
    }
    const raw = text.slice(start, end);
    const href = trimTrailingUrlPunctuation(raw);
    const trailing = raw.slice(href.length);
    out.push({ kind: 'url', href, trailing });
    last = start + raw.length;
  }
  return out.length > 0 ? out : [{ kind: 'text', value: text }];
}

const chatBodyLinkClass =
  'break-all font-medium text-primary underline decoration-primary/35 underline-offset-2 hover:decoration-primary/70';

/** Discord-style compact chip for Hypha chat deep links (short `?msg=` URLs). */
const chatDeepLinkPillClass =
  'inline-flex max-w-[min(100%,18rem)] min-w-0 items-center gap-1 self-baseline truncate rounded-md bg-accent-3 px-2 py-0.5 text-[13px] font-semibold leading-snug text-accent-12 ring-1 ring-inset ring-accent-8/40 dark:bg-accent-3/50 dark:text-accent-12 dark:ring-accent-8/25';

function shortMatrixEventLabel(id: string): string {
  const t = id.trim();
  if (!t) return '';
  if (t.startsWith('$') && t.length > 14) return `${t.slice(0, 10)}…`;
  return t.length > 16 ? `${t.slice(0, 12)}…` : t;
}

function renderPlainUrlLink(href: string, key: string): ReactNode {
  const safe = href.trim();
  if (!safe) return null;
  if (isHyphaDhoChatMessageUrl(safe)) {
    const slug = hyphaDhoSlugFromUrl(safe) ?? 'chat';
    let msgShort = '';
    try {
      const msg = new URL(safe).searchParams.get('msg');
      if (msg) msgShort = shortMatrixEventLabel(msg);
    } catch {
      // ignore
    }
    const label = msgShort ? `# ${slug} · ${msgShort}` : `# ${slug}`;
    return (
      <a
        key={key}
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        title={safe}
        className={chatDeepLinkPillClass}
      >
        {label}
      </a>
    );
  }
  return (
    <a
      key={key}
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className={chatBodyLinkClass}
    >
      {safe}
    </a>
  );
}

/**
 * `@mxid` pill in message body: sync label from room/roster may be a technical bridged ID after reload.
 * Mirror sender-row logic — resolve Hypha Person via matrix_user_links when the label still looks synthetic.
 */
function MxidMentionPill({
  fullMxid,
  syncLabel,
  viewerMentionTintRow,
}: {
  fullMxid: string;
  syncLabel: string;
  viewerMentionTintRow: boolean;
}) {
  const needsProfile = needsHyphaProfileForMatrixLabel(syncLabel, fullMxid);
  const canonicalSub = needsProfile
    ? matrixUserIdToCanonicalPrivySub(fullMxid) ?? undefined
    : undefined;
  const { privyUserId: linkedSub, isLoading: loadingLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId: needsProfile && !canonicalSub ? fullMxid : undefined,
    });
  const { person, isLoading: loadingPerson } = usePersonBySub({
    sub: linkedSub ?? canonicalSub ?? undefined,
  });

  const displayLabel = useMemo(() => {
    const fromPerson = person ? formatPersonDisplayName(person) : '';
    const visible = pickUserVisibleMemberLabel(fullMxid, fromPerson, syncLabel);
    if (!visible) return '';
    return visible.startsWith('@') ? visible : `@${visible}`;
  }, [person, syncLabel, fullMxid]);

  const loading =
    needsProfile &&
    (loadingLink ||
      (Boolean(linkedSub ?? canonicalSub) && loadingPerson) ||
      !displayLabel.trim());

  if (loading) {
    return (
      <Skeleton
        className="inline-block rounded align-baseline"
        loading
        width={100}
        height={14}
      />
    );
  }

  return (
    <span className={chatMentionPillClass(viewerMentionTintRow)}>
      {displayLabel}
    </span>
  );
}

/**
 * Render plaintext with Matrix MXIDs as pills showing room display names (`resolveMx`).
 * Non‑MXID `@handles` keep optional Discord-style pills (no colon in capture).
 */
export function renderTextWithMentions(
  text: string,
  resolveMx: (matrixUserId: string) => string,
  viewerMentionTintRow = false,
): React.ReactNode[] {
  const segments = splitPlainTextMatrixMentions(text);
  const localHandleRe = /(^|[^\w.+-])@([^\s@]{1,100}?)(?=\s|$|[.,!?;:])/g;

  const mapPlainFragmentWithMentionsOnly = (
    fragment: string,
    keyBase: string,
  ): React.ReactNode[] => {
    const chunks: React.ReactNode[] = [];
    let last = 0;
    let mh: RegExpExecArray | null;
    const reLocal = new RegExp(localHandleRe.source, localHandleRe.flags);
    let keyN = 0;
    while ((mh = reLocal.exec(fragment)) !== null) {
      const prefix = mh[1] ?? '';
      const handle = mh[2]?.trim() ?? '';
      const mentionStart = mh.index + prefix.length;
      if (mentionStart > last) {
        chunks.push(
          <span key={`${keyBase}-t-${keyN++}`}>
            {fragment.slice(last, mentionStart)}
          </span>,
        );
      }
      chunks.push(
        <span
          key={`${keyBase}-at-${keyN++}`}
          className={chatMentionPillClass(viewerMentionTintRow)}
        >
          @{handle}
        </span>,
      );
      last = mentionStart + handle.length + 1;
    }
    if (last < fragment.length) {
      chunks.push(
        <span key={`${keyBase}-t-${keyN++}`}>{fragment.slice(last)}</span>,
      );
    }
    if (chunks.length === 0 && fragment) {
      return [<span key={keyBase}>{fragment}</span>];
    }
    return chunks;
  };

  const mapPlainFragment = (
    fragment: string,
    keyBase: string,
  ): React.ReactNode[] => {
    const pieces = splitPlainTextUrls(fragment);
    const out: React.ReactNode[] = [];
    let pieceIdx = 0;
    for (const piece of pieces) {
      if (piece.kind === 'text') {
        out.push(
          ...mapPlainFragmentWithMentionsOnly(
            piece.value,
            `${keyBase}-tx${pieceIdx++}`,
          ),
        );
      } else {
        const linkKey = `${keyBase}-url${pieceIdx++}`;
        const linkEl = renderPlainUrlLink(piece.href, linkKey);
        if (linkEl) out.push(linkEl);
        if (piece.trailing) {
          out.push(
            ...mapPlainFragmentWithMentionsOnly(
              piece.trailing,
              `${keyBase}-trail${pieceIdx++}`,
            ),
          );
        }
      }
    }
    return out;
  };

  const parts: React.ReactNode[] = [];
  let segIdx = 0;
  for (const seg of segments) {
    if (seg.kind === 'mxid') {
      const syncLabel = resolveMx(seg.full).trim();
      parts.push(
        <MxidMentionPill
          key={`mx-${segIdx}-${seg.full}`}
          fullMxid={seg.full}
          syncLabel={syncLabel}
          viewerMentionTintRow={viewerMentionTintRow}
        />,
      );
    } else if (seg.value) {
      parts.push(...mapPlainFragment(seg.value, `seg-${segIdx}`));
    }
    segIdx += 1;
  }
  return parts;
}

function resolveMatrixPlainAndHtmlFragments(
  fragment: string,
  resolveMx: (matrixUserId: string) => string,
  viewerMentionTintRow = false,
): React.ReactNode[] {
  return renderTextWithMentions(fragment, resolveMx, viewerMentionTintRow);
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
  resolveMatrixMemberLabel,
  resolveSenderDisplayLabel,
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
  const bodyResolveMx = useMemo(
    () =>
      resolveMatrixMemberLabel ??
      ((matrixUserId: string) =>
        matrixMemberDisplayLabelFromRoom(client, roomId ?? null, matrixUserId)),
    [resolveMatrixMemberLabel, client, roomId],
  );
  const [hoverReactPickerOpen, setHoverReactPickerOpen] = useState(false);
  const [inlineReactPickerOpen, setInlineReactPickerOpen] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const textBodyRef = useRef<HTMLDivElement>(null);
  const [textExpanded, setTextExpanded] = useState(false);
  const [textCanExpand, setTextCanExpand] = useState(false);

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

  const rosterSenderLabel =
    message.role === 'member' && message.senderMatrixId
      ? resolveSenderDisplayLabel?.(message.senderMatrixId)
      : undefined;
  const rosterReplyLabel =
    replyTo?.sourceUserId != null
      ? resolveSenderDisplayLabel?.(replyTo.sourceUserId)
      : undefined;

  const resolveSenderProfile =
    message.role === 'member' &&
    needsHyphaProfileForMatrixLabel(
      rosterSenderLabel ?? message.senderName,
      message.senderMatrixId,
    );
  const resolveReplyProfile =
    replyTo?.sourceUserId != null &&
    needsHyphaProfileForMatrixLabel(
      rosterReplyLabel ?? replyTo.authorLabel,
      replyTo.sourceUserId,
    );

  const senderCanonicalSub =
    resolveSenderProfile && message.senderMatrixId
      ? matrixUserIdToCanonicalPrivySub(message.senderMatrixId) ?? undefined
      : undefined;
  const replyCanonicalSub =
    resolveReplyProfile && replyTo?.sourceUserId
      ? matrixUserIdToCanonicalPrivySub(replyTo.sourceUserId) ?? undefined
      : undefined;

  const { privyUserId: senderPrivySub, isLoading: isLoadingSenderLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId:
        resolveSenderProfile && !senderCanonicalSub
          ? message.senderMatrixId
          : undefined,
    });
  const { privyUserId: replyPrivySub, isLoading: isLoadingReplyLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId:
        resolveReplyProfile && !replyCanonicalSub
          ? replyTo?.sourceUserId
          : undefined,
    });

  const { person: senderPerson, isLoading: isLoadingSenderPerson } =
    usePersonBySub({ sub: senderPrivySub ?? senderCanonicalSub });
  const { person: replyPerson, isLoading: isLoadingReplyPerson } =
    usePersonBySub({ sub: replyPrivySub ?? replyCanonicalSub });

  const resolvedSenderName = useMemo(() => {
    if (message.role === 'user') {
      return message.senderName ?? t('you');
    }
    const fromPerson = senderPerson
      ? formatPersonDisplayName(senderPerson)
      : '';
    const visible =
      message.senderMatrixId != null
        ? pickUserVisibleMemberLabel(
            message.senderMatrixId,
            fromPerson,
            rosterSenderLabel,
            message.senderName,
          )
        : fromPerson || rosterSenderLabel?.trim() || message.senderName?.trim();
    return visible ?? t('unknownMember');
  }, [
    message.role,
    message.senderMatrixId,
    message.senderName,
    rosterSenderLabel,
    senderPerson,
    t,
  ]);

  const resolvedReplyAuthorLabel = useMemo(() => {
    if (!replyTo) return '';
    const fromPerson = replyPerson ? formatPersonDisplayName(replyPerson) : '';
    const visible =
      replyTo.sourceUserId != null
        ? pickUserVisibleMemberLabel(
            replyTo.sourceUserId,
            fromPerson,
            rosterReplyLabel,
            replyTo.authorLabel,
          )
        : fromPerson || rosterReplyLabel?.trim() || replyTo.authorLabel?.trim();
    return visible ?? t('unknownMember');
  }, [replyPerson, replyTo, rosterReplyLabel, t]);

  const senderHasVisibleLabel = useMemo(() => {
    if (message.role !== 'member' || !message.senderMatrixId) return true;
    return Boolean(
      pickUserVisibleMemberLabel(
        message.senderMatrixId,
        senderPerson ? formatPersonDisplayName(senderPerson) : '',
        rosterSenderLabel,
        message.senderName,
      ),
    );
  }, [
    message.role,
    message.senderMatrixId,
    message.senderName,
    rosterSenderLabel,
    senderPerson,
  ]);

  /**
   * Show header skeleton while SWR is in flight or labels are still technical after idle.
   * Never surface bridged Privy locals — fall back to "Unknown member" once resolution finishes.
   */
  const senderProfileLoading =
    message.role === 'member' &&
    Boolean(message.senderMatrixId) &&
    !senderHasVisibleLabel &&
    (resolveSenderProfile
      ? isLoadingSenderLink ||
        (Boolean(senderPrivySub ?? senderCanonicalSub) && isLoadingSenderPerson)
      : needsHyphaProfileForMatrixLabel(
          rosterSenderLabel ?? message.senderName,
          message.senderMatrixId,
        ));

  const replyProfileLoading =
    replyTo?.sourceUserId != null &&
    !pickUserVisibleMemberLabel(
      replyTo.sourceUserId,
      replyPerson ? formatPersonDisplayName(replyPerson) : '',
      rosterReplyLabel,
      replyTo.authorLabel,
    ) &&
    (resolveReplyProfile
      ? isLoadingReplyLink ||
        (Boolean(replyPrivySub ?? replyCanonicalSub) && isLoadingReplyPerson)
      : needsHyphaProfileForMatrixLabel(
          rosterReplyLabel ?? replyTo.authorLabel,
          replyTo.sourceUserId,
        ));

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
  const hasInlineMedia =
    Boolean(message.media) ||
    Boolean(message.mediaSlots && message.mediaSlots.length > 0);
  const textBodyClassName = cn(
    'text-sm leading-snug text-foreground',
    hasInlineMedia ? 'mt-1' : 'mt-0',
    !textExpanded && 'line-clamp-10',
  );

  useEffect(() => {
    setTextExpanded(false);
  }, [message.id, textContent, message.formattedContentHtml]);

  useLayoutEffect(() => {
    const el = textBodyRef.current;
    if (!el || !textContent.trim()) {
      setTextCanExpand(false);
      return;
    }
    if (textExpanded) return;
    const measure = () => {
      setTextCanExpand(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [textContent, textExpanded, message.formattedContentHtml, hasInlineMedia]);

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
          'border-l-[3px] border-l-accent-9 bg-muted/75 dark:border-l-accent-10 dark:bg-muted/55',
        unreadBoundary &&
          !highlightMentionForViewer &&
          'border-l-[3px] border-l-border bg-muted/75 dark:border-l-border dark:bg-muted/55',
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
              className={APP_CHROME_SUBTLE_SQUARE_RADIUS}
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
              className={APP_CHROME_SUBTLE_SQUARE_RADIUS}
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
              className="relative mt-1.5 max-w-md overflow-hidden rounded-lg border border-border bg-gradient-to-b from-card to-muted/30 shadow-sm"
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
              <div
                ref={textBodyRef}
                data-testid="chat-message-body"
                className={textBodyClassName}
              >
                <ChatMessageRichText
                  html={message.formattedContentHtml}
                  transformText={(fragment) =>
                    resolveMatrixPlainAndHtmlFragments(
                      fragment,
                      bodyResolveMx,
                      highlightMentionForViewer,
                    )
                  }
                />
              </div>
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
              <div
                ref={textBodyRef}
                data-testid="chat-message-body"
                className={textBodyClassName}
              >
                {renderTextWithMentions(
                  textContent,
                  bodyResolveMx,
                  highlightMentionForViewer,
                )}
              </div>
            ))}
          {textContent && textCanExpand && jumboLayout.mode !== 'jumbo' ? (
            <button
              type="button"
              className="mt-1 w-fit text-xs font-medium text-accent-11 underline-offset-4 hover:underline"
              onClick={() => setTextExpanded((v) => !v)}
            >
              {textExpanded ? t('messageShowLess') : t('messageReadMore')}
            </button>
          ) : null}

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
                    {!(message.media.spoiler && !spoilerRevealed) && (
                      <ChatMediaAmbientOverlay />
                    )}
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
      resolveMatrixMemberLabel={bodyResolveMx}
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
