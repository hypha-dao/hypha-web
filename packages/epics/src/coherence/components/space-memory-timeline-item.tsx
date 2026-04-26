'use client';

import type { SpaceMemoryItem } from '@hypha-platform/core/client';
import { useMatrix } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { ExternalLink, FileIcon, Image as ImageIcon, Play } from 'lucide-react';
import { formatDate } from '@hypha-platform/ui-utils';
import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

/** Preview tile — full width of grid cell, fixed height like Human Chat thumbnails */
const THUMB_SHELL =
  'relative flex h-44 w-full max-w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30';

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

function looksLikeVideo(name: string, url: string): boolean {
  return (
    /\.(mp4|webm|mov|mkv|m4v)(\?|#|$)/i.test(name) ||
    /\.(mp4|webm|mov|mkv|m4v)(\?|#|$)/i.test(url)
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
  const [imageFailed, setImageFailed] = React.useState(false);
  /** Proposal URLs sometimes lack MIME/extension in org-memory — try `<img>` then fall back. */
  const [httpImageProbeFailed, setHttpImageProbeFailed] = React.useState(false);
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
    setHttpImageProbeFailed(false);
    setMatrixImagePhase('preview');
  }, [mxc, client, item.id]);

  const httpSafe = isSafeAssetUrl(item.url);
  const tryHttpImageFirst =
    !mxc &&
    httpSafe &&
    item.source === 'proposal_upload' &&
    !looksLikePdf(item.name, item.url) &&
    !looksLikeVideo(item.name, item.url) &&
    (item.kind === 'image' ||
      item.kind === 'other' ||
      (item.kind === 'document' && !looksLikePdf(item.name, item.url)));

  const imageSrcForMatrix =
    item.kind === 'image' && mxc
      ? matrixImagePhase === 'preview' && matrixThumbDistinct
        ? mxcPreview
        : mxcDownload
      : null;
  const videoSrcForMatrix = item.kind === 'video' ? mxcDownload : null;
  const openHref = mxc ? mxcDownload : item.url;
  const canOpen = Boolean(openHref && isSafeAssetUrl(openHref));

  const thumbPreview = (() => {
    if (mxc) {
      if (looksLikePdf(item.name, item.url)) {
        return (
          <FileIcon
            className="h-12 w-12 text-muted-foreground"
            strokeWidth={1.25}
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
              {item.name}
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
    if (tryHttpImageFirst && !httpImageProbeFailed && !imageFailed) {
      return (
        <img
          src={item.url}
          alt=""
          className="max-h-full max-w-full object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (item.kind === 'image') {
              setImageFailed(true);
            } else {
              setHttpImageProbeFailed(true);
            }
          }}
        />
      );
    }
    if (item.kind === 'image' && !imageFailed) {
      if (looksLikePdf(item.name, item.url)) {
        return (
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
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      );
    }
    if (item.kind === 'image' && imageFailed) {
      return (
        <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
          <ImageIcon className="h-8 w-8 opacity-70" strokeWidth={1.25} />
          <span className="line-clamp-2 text-center text-[10px]">
            {item.name}
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
  })();

  const linkClass =
    'group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  const filenameRowClass =
    'inline-flex items-start gap-1 text-xs font-medium leading-snug text-foreground underline-offset-2 group-hover:text-primary group-hover:underline';

  return (
    <li className="flex min-w-0 w-full shrink-0 flex-col items-stretch">
      <span
        className="mb-1.5 h-2 w-2 shrink-0 self-center rounded-full border-2 border-background bg-accent-9 shadow-sm ring-1 ring-border"
        aria-hidden
      />
      <time
        dateTime={item.uploadedAt}
        className="text-center text-[10px] font-medium leading-tight text-muted-foreground"
      >
        {uploaded}
      </time>
      <p className="mt-0.5 line-clamp-2 text-center text-[10px] leading-tight text-muted-foreground">
        {contextLine}
      </p>

      <div className="mt-2 flex flex-col gap-2">
        {canOpen ? (
          <a
            href={openHref!}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
            aria-label={openLabel}
          >
            <div className={cn(THUMB_SHELL, 'min-h-[120px]')}>
              {thumbPreview}
            </div>
            <span className={filenameRowClass}>
              <span className="line-clamp-3 break-words">{item.name}</span>
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
            </span>
          </a>
        ) : (
          <div
            className="flex flex-col gap-2 rounded-lg"
            title={mxc && !canOpen ? t('spaceMemoryMatrixOpenHint') : undefined}
          >
            <div className={cn(THUMB_SHELL, 'min-h-[120px]')}>
              {thumbPreview}
            </div>
            <span className="line-clamp-3 break-words text-xs font-medium text-foreground">
              {item.name}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}
