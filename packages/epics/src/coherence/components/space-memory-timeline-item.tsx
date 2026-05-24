'use client';

import type { SpaceMemoryItem } from '@hypha-platform/core/client';
import {
  deriveSpaceMemoryDisplayTitle,
  useMatrix,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { ExternalLink, FileIcon, Image as ImageIcon, Play } from 'lucide-react';
import { formatDate } from '@hypha-platform/ui-utils';
import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ResolvedCallTranscriptExcerpt } from './resolved-call-transcript-excerpt';

/** Centered play affordance for call recordings in Space Memory. */
function CallRecordingMediaPreview({
  src,
  poster,
  variant,
  playLabel,
}: {
  src: string;
  poster?: string | null;
  variant: 'video' | 'audio';
  playLabel: string;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      {variant === 'video' ? (
        <video
          src={src}
          poster={poster ?? undefined}
          muted
          playsInline
          preload="metadata"
          className="max-h-full max-w-full object-contain"
        >
          <track kind="captions" />
        </video>
      ) : (
        <audio src={src} preload="metadata" className="sr-only">
          <track kind="captions" />
        </audio>
      )}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-md ring-1 ring-white/20">
          <Play className="h-6 w-6 fill-current" aria-hidden />
        </span>
      </span>
      <span className="pointer-events-none absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 rounded bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white/95">
        <span className="line-clamp-1">{playLabel}</span>
      </span>
    </div>
  );
}

/** Matches Human Chat image slot: rounded shell with safe media preview. */
const THUMB_SHELL =
  'relative flex min-h-[160px] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30';

function isSafeAssetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function isMxcUrl(url: string): boolean {
  return url.trim().startsWith('mxc://');
}

function looksLikePdf(name: string, url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(name) || /\.pdf(\?|#|$)/i.test(url);
}

let didConfigurePdfWorker = false;

async function loadPdfJsWithWorker() {
  const pdfJs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!didConfigurePdfWorker) {
    try {
      const workerUrl = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.mjs',
        import.meta.url,
      ).toString();
      pdfJs.GlobalWorkerOptions.workerSrc = workerUrl;
    } catch {
      // Keep default worker resolution if URL construction fails.
    }
    didConfigurePdfWorker = true;
  }
  return pdfJs;
}

export function humanizeAssetName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return name;
  const sanitized = trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.()]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || name;
}

function PdfPreview({
  src,
  fallbackLabel,
  unavailableLabel,
}: {
  src: string;
  fallbackLabel: string;
  unavailableLabel: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [renderState, setRenderState] = React.useState<
    'loading' | 'ready' | 'embed' | 'error'
  >('loading');

  React.useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => void } | null = null;
    let pdf: { destroy: () => Promise<void> } | null = null;

    async function renderFirstPage(): Promise<void> {
      try {
        setRenderState('loading');
        const pdfJs = await loadPdfJsWithWorker();
        const request: Parameters<typeof pdfJs.getDocument>[0] = {
          url: src,
          verbosity: 0,
        };
        const task = pdfJs.getDocument(request);
        loadingTask = task;
        const loadedPdf = await task.promise;
        pdf = loadedPdf;
        const page = await loadedPdf.getPage(1);

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2, Math.max(0.6, 900 / baseViewport.width));
        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (!canvas || !context || cancelled) return;

        canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
        canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
        canvas.style.width = `${Math.max(1, Math.floor(viewport.width))}px`;
        canvas.style.height = `${Math.max(1, Math.floor(viewport.height))}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        await page.render({ canvas, canvasContext: context, viewport }).promise;

        if (!cancelled) {
          setRenderState('ready');
        }
      } catch {
        if (!cancelled) {
          // Fallback to native PDF embed if canvas pipeline fails.
          setRenderState('embed');
        }
      } finally {
        await pdf?.destroy().catch(() => undefined);
      }
    }

    void renderFirstPage();
    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
    };
  }, [src]);

  if (renderState === 'embed') {
    return (
      <object
        data={src}
        type="application/pdf"
        aria-label={fallbackLabel}
        className="h-full w-full"
      >
        <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
          <FileIcon className="h-8 w-8 opacity-70" strokeWidth={1.25} />
          <span className="line-clamp-2 text-center text-[10px]">
            {unavailableLabel}
          </span>
        </div>
      </object>
    );
  }

  if (renderState === 'error') {
    return (
      <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
        <FileIcon className="h-8 w-8 opacity-70" strokeWidth={1.25} />
        <span className="line-clamp-2 text-center text-[10px]">
          {unavailableLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        aria-label={fallbackLabel}
        className={cn(
          'max-h-full max-w-full object-contain',
          renderState === 'ready' ? 'opacity-100' : 'opacity-0',
        )}
      />
      {renderState === 'loading' ? (
        <div className="absolute inset-0 flex min-h-[120px] w-full flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
          <FileIcon
            className="h-8 w-8 animate-pulse opacity-70"
            strokeWidth={1.25}
          />
          <span className="line-clamp-2 text-center text-[10px]">
            {fallbackLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}

type MatrixClientLike = NonNullable<ReturnType<typeof useMatrix>['client']>;

function resolveMxcUrls(
  client: MatrixClientLike | null,
  mxc: string,
): { download: string | null; preview: string | null } {
  if (!client || !mxc.startsWith('mxc://')) {
    return { download: null, preview: null };
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
  return { download, preview };
}

type SpaceMemoryTimelineItemProps = {
  item: SpaceMemoryItem;
  contextLine: string;
  openLabel: string;
};

/**
 * Horizontal timeline tile: dot + time + context + preview (Human Chat–style) + filename.
 * Matrix-backed rows use `mxc://` — resolved to HTTPS via the same Matrix client as Human Chat.
 */
export function SpaceMemoryTimelineItem({
  item,
  contextLine,
  openLabel,
}: SpaceMemoryTimelineItemProps) {
  const t = useTranslations('CoherenceTab');
  const { client, isMatrixAvailable } = useMatrix();
  const uploaded = formatDate(new Date(item.uploadedAt), true);
  const displayName = useMemo(
    () =>
      deriveSpaceMemoryDisplayTitle({
        source: item.source,
        name: item.name,
        contextTitle: item.context.contextTitle,
        textExcerpt: item.context.textExcerpt,
        documentTitle: item.context.documentTitle,
      }),
    [item],
  );
  const [imageFailed, setImageFailed] = React.useState(false);
  /** After a scaled thumbnail fails, retry full media (Synapse sometimes fails thumbnailing only). */
  const [matrixImagePhase, setMatrixImagePhase] = React.useState<
    'preview' | 'full'
  >('preview');

  const mxc = isMxcUrl(item.url) ? item.url.trim() : null;
  const { download: mxcDownload, preview: mxcPreview } = useMemo(
    () =>
      mxc ? resolveMxcUrls(client, mxc) : { download: null, preview: null },
    [client, mxc],
  );

  const matrixThumbDistinct = Boolean(
    mxcPreview && mxcDownload && mxcPreview !== mxcDownload,
  );

  React.useEffect(() => {
    setImageFailed(false);
    setMatrixImagePhase('preview');
  }, [mxc, client, item.id]);

  const httpSafe = isSafeAssetUrl(item.url);
  const imageSrcForMatrix =
    item.kind === 'image' && mxc
      ? matrixImagePhase === 'preview' && matrixThumbDistinct
        ? mxcPreview
        : mxcDownload
      : null;
  const videoSrcForMatrix = item.kind === 'video' ? mxcDownload : null;
  const pdfSrc =
    looksLikePdf(item.name, item.url) && (mxc ? mxcDownload : httpSafe)
      ? mxc
        ? mxcDownload
        : item.url
      : null;
  const openHref = mxc ? mxcDownload : item.url;
  const isMemoryBody =
    item.source === 'memory' && item.url.startsWith('memory://document/');
  const isCallTranscriptBody =
    item.source === 'call_transcript' &&
    item.url.startsWith('memory://call_transcript/');
  const canOpen = Boolean(
    !isMemoryBody &&
      !isCallTranscriptBody &&
      openHref &&
      isSafeAssetUrl(openHref),
  );
  const cardTitle =
    isMemoryBody && item.context.documentTitle?.trim()
      ? item.context.documentTitle.trim()
      : displayName;

  const isCallRecording = item.source === 'call_recording';
  const openLinkLabel = isCallRecording
    ? t('spaceMemoryPlayCallRecording')
    : t('openDocument');

  const thumbPreview = (() => {
    if (isMemoryBody || isCallTranscriptBody) {
      const excerpt =
        item.context.textExcerpt?.trim() ||
        item.context.documentTitle?.trim() ||
        displayName;
      return (
        <div className="flex min-h-[120px] w-full flex-col justify-start gap-2 overflow-y-auto px-3 py-3 text-left">
          {isCallTranscriptBody ? (
            <ResolvedCallTranscriptExcerpt
              excerpt={excerpt}
              className="line-clamp-8 whitespace-pre-wrap text-sm leading-relaxed text-card-foreground"
            />
          ) : (
            <p className="line-clamp-8 whitespace-pre-wrap text-sm leading-relaxed text-card-foreground">
              {excerpt}
            </p>
          )}
        </div>
      );
    }
    if (mxc) {
      if (looksLikePdf(item.name, item.url) && pdfSrc) {
        return (
          <PdfPreview
            src={pdfSrc}
            fallbackLabel={displayName}
            unavailableLabel={t('spaceMemoryPdfPreviewUnavailable')}
          />
        );
      }
      if (!isMatrixAvailable || !client) {
        return (
          <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-muted-foreground">
            <FileIcon className="h-10 w-10 opacity-70" strokeWidth={1.25} />
            <span className="line-clamp-3">
              {t('spaceMemoryMatrixPreviewNeedsChat')}
            </span>
          </div>
        );
      }
      if (isCallRecording && mxcDownload) {
        return (
          <CallRecordingMediaPreview
            src={mxcDownload}
            poster={mxcPreview}
            variant={item.kind === 'video' ? 'video' : 'audio'}
            playLabel={t('spaceMemoryPlayCallRecording')}
          />
        );
      }
      if (item.kind === 'image' && !imageFailed) {
        const src = imageSrcForMatrix;
        if (!src) {
          return (
            <FileIcon
              className="h-12 w-12 text-muted-foreground"
              strokeWidth={1.25}
            />
          );
        }
        return (
          <img
            key={`${item.id}-${matrixImagePhase}`}
            src={src}
            alt=""
            className="max-h-full max-w-full object-contain"
            loading="lazy"
            onError={() => {
              if (
                matrixImagePhase === 'preview' &&
                matrixThumbDistinct &&
                mxcDownload
              ) {
                setMatrixImagePhase('full');
                return;
              }
              setImageFailed(true);
            }}
          />
        );
      }
      if (item.kind === 'image' && imageFailed) {
        return (
          <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-70" strokeWidth={1.25} />
            <span className="line-clamp-2 text-center text-[10px]">
              {displayName}
            </span>
          </div>
        );
      }
      if (item.kind === 'video' && videoSrcForMatrix) {
        return (
          <div className="relative flex h-full w-full items-center justify-center">
            <video
              src={videoSrcForMatrix}
              poster={mxcPreview ?? undefined}
              muted
              playsInline
              preload="metadata"
              className="max-h-full max-w-full object-contain bg-black"
            >
              <track kind="captions" />
            </video>
            <span className="pointer-events-none absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 rounded bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white/95">
              <Play className="h-3 w-3 shrink-0" aria-hidden />
              <span className="line-clamp-1">
                {t('spaceMemoryMatrixVideoPlayHint')}
              </span>
            </span>
          </div>
        );
      }
      if (item.kind === 'document' && looksLikePdf(item.name, item.url)) {
        return (
          <FileIcon
            className="h-12 w-12 text-muted-foreground"
            strokeWidth={1.25}
          />
        );
      }
      return (
        <FileIcon
          className="h-12 w-12 text-muted-foreground"
          strokeWidth={1.25}
        />
      );
    }

    if (!httpSafe) {
      return (
        <FileIcon
          className="h-12 w-12 text-muted-foreground"
          strokeWidth={1.25}
        />
      );
    }
    if (isCallRecording) {
      return (
        <CallRecordingMediaPreview
          src={item.url}
          variant={item.kind === 'video' ? 'video' : 'audio'}
          playLabel={t('spaceMemoryPlayCallRecording')}
        />
      );
    }
    if (item.kind === 'image' && !imageFailed) {
      if (looksLikePdf(item.name, item.url)) {
        return pdfSrc ? (
          <PdfPreview
            src={pdfSrc}
            fallbackLabel={displayName}
            unavailableLabel={t('spaceMemoryPdfPreviewUnavailable')}
          />
        ) : (
          <FileIcon
            className="h-12 w-12 text-muted-foreground"
            strokeWidth={1.25}
          />
        );
      }
      return (
        <img
          src={item.url}
          alt=""
          className="max-h-full max-w-full object-contain"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      );
    }
    if (item.kind === 'image' && imageFailed) {
      return (
        <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
          <ImageIcon className="h-8 w-8 opacity-70" strokeWidth={1.25} />
          <span className="line-clamp-2 text-center text-[10px]">
            {displayName}
          </span>
        </div>
      );
    }
    if (item.kind === 'video') {
      return (
        <video
          src={item.url}
          muted
          playsInline
          preload="none"
          className="max-h-full max-w-full object-contain bg-black"
        >
          <track kind="captions" />
        </video>
      );
    }
    if (item.kind === 'document' && looksLikePdf(item.name, item.url)) {
      return pdfSrc ? (
        <PdfPreview
          src={pdfSrc}
          fallbackLabel={displayName}
          unavailableLabel={t('spaceMemoryPdfPreviewUnavailable')}
        />
      ) : (
        <FileIcon
          className="h-12 w-12 text-muted-foreground"
          strokeWidth={1.25}
        />
      );
    }
    return (
      <FileIcon
        className="h-12 w-12 text-muted-foreground"
        strokeWidth={1.25}
      />
    );
  })();

  const linkClass =
    'group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  const filenameRowClass =
    'inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground underline-offset-2 group-hover:text-primary group-hover:underline';

  const sourceLabel = (() => {
    if (item.source === 'memory') return t('spaceMemory');
    if (item.source === 'proposal_upload') return t('spaceMemoryProposals');
    if (item.source === 'matrix_chat') return t('spaceMemoryConversations');
    if (item.source === 'discussion_summary')
      return t('spaceMemoryConversations');
    if (item.source === 'call_transcript')
      return t('spaceMemoryCallTranscriptExcerpt');
    if (item.source === 'call_recording') return t('spaceMemoryCalls');
    return t('spaceMemory');
  })();

  return (
    <li className="flex h-full w-full flex-col rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-md bg-accent-9 px-2 py-0.5 text-[11px] font-semibold text-accent-contrast">
          {sourceLabel}
        </span>
        <time
          dateTime={item.uploadedAt}
          className="text-[10px] font-medium leading-tight text-muted-foreground"
        >
          {uploaded}
        </time>
      </div>
      <p className="line-clamp-2 text-xs leading-tight text-muted-foreground">
        {contextLine}
      </p>
      <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-card-foreground">
        {cardTitle}
      </p>

      <div className="mt-3 flex flex-1 flex-col gap-2">
        {canOpen ? (
          <a
            href={openHref!}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
            aria-label={openLabel}
          >
            <div className={cn(THUMB_SHELL, 'aspect-[16/10]')}>
              {thumbPreview}
            </div>
            <span className={filenameRowClass}>
              <span>{openLinkLabel}</span>
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
            </span>
          </a>
        ) : (
          <div
            className="flex flex-col gap-2 rounded-lg"
            title={mxc && !canOpen ? t('spaceMemoryMatrixOpenHint') : undefined}
          >
            <div className={cn(THUMB_SHELL, 'aspect-[16/10]')}>
              {thumbPreview}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
