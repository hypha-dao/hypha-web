'use client';

import type { SpaceMemoryItem } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { ExternalLink, FileIcon, Image as ImageIcon } from 'lucide-react';
import { formatDate } from '@hypha-platform/ui-utils';
import React from 'react';

/** Matches Human Chat image slot: `rounded-lg border border-border bg-muted/30` + object-contain preview */
const THUMB_SHELL =
  'relative flex h-44 w-44 max-w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30';

function isSafeAssetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function isLikelyPdf(url: string, filename: string): boolean {
  return /\.pdf(\?|$|#)/i.test(`${url} ${filename}`);
}

type SpaceMemoryTimelineItemProps = {
  item: SpaceMemoryItem;
  contextLine: string;
  openLabel: string;
};

/**
 * Horizontal timeline tile: dot + time + context + preview (Human Chat–style) + filename.
 */
export function SpaceMemoryTimelineItem({
  item,
  contextLine,
  openLabel,
}: SpaceMemoryTimelineItemProps) {
  const safe = isSafeAssetUrl(item.url);
  const uploaded = formatDate(new Date(item.uploadedAt), true);
  const [imageFailed, setImageFailed] = React.useState(false);

  const tryPdfEmbed =
    safe &&
    (item.kind === 'document' || item.kind === 'other') &&
    isLikelyPdf(item.url, item.name);

  const thumbPreview = (() => {
    if (!safe) {
      return (
        <FileIcon
          className="h-12 w-12 text-muted-foreground"
          strokeWidth={1.25}
        />
      );
    }
    if (item.kind === 'image' && !imageFailed) {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- CDN / signed URLs
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
          preload="metadata"
          className="max-h-full max-w-full object-contain bg-black"
        >
          <track kind="captions" />
        </video>
      );
    }
    if (tryPdfEmbed) {
      return (
        <iframe
          title=""
          src={item.url}
          className="pointer-events-none h-[120%] w-full min-h-[7rem] border-0 bg-muted/20"
          loading="lazy"
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

  return (
    <li className="flex w-44 shrink-0 flex-col items-stretch">
      <span
        className="mb-1.5 h-2 w-2 shrink-0 self-center rounded-full border-2 border-background bg-accent-9 shadow-sm ring-1 ring-border"
        aria-hidden
      />
      <time
        dateTime={item.uploadedAt}
        className="text-[10px] font-medium leading-tight text-muted-foreground"
      >
        {uploaded}
      </time>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
        {contextLine}
      </p>

      <div className="mt-2 flex flex-col gap-2">
        {safe ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={openLabel}
          >
            <div className={cn(THUMB_SHELL, 'min-h-[120px]')}>
              {thumbPreview}
            </div>
            <span className="inline-flex items-start gap-1 text-xs font-medium leading-snug text-foreground underline-offset-2 group-hover:text-primary group-hover:underline">
              <span className="line-clamp-3 break-words">{item.name}</span>
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
            </span>
          </a>
        ) : (
          <>
            <div className={cn(THUMB_SHELL, 'min-h-[120px]')}>
              {thumbPreview}
            </div>
            <span className="line-clamp-3 break-words text-xs font-medium text-foreground">
              {item.name}
            </span>
          </>
        )}
      </div>
    </li>
  );
}
