'use client';

import type { SpaceMemoryItem } from '@hypha-platform/core/client';
import { ExternalLink, FileIcon, Image as ImageIcon } from 'lucide-react';
import { formatDate } from '@hypha-platform/ui-utils';
import React from 'react';

const THUMB_CLASS =
  'h-44 w-44 max-w-full overflow-hidden rounded-xl border border-border bg-muted/40';

function isSafeAssetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

type SpaceMemoryTimelineItemProps = {
  item: SpaceMemoryItem;
  contextLine: string;
  openLabel: string;
  isLast: boolean;
};

/**
 * Timeline row: connector + time/context + medium thumbnail + filename below (history overview).
 */
export function SpaceMemoryTimelineItem({
  item,
  contextLine,
  openLabel,
  isLast,
}: SpaceMemoryTimelineItemProps) {
  const safe = isSafeAssetUrl(item.url);
  const uploaded = formatDate(new Date(item.uploadedAt), true);
  const [imageFailed, setImageFailed] = React.useState(false);

  const showImage = safe && item.kind === 'image' && !imageFailed;
  const showVideo = safe && item.kind === 'video';
  const showPdfOrDocThumb =
    safe && (item.kind === 'document' || item.kind === 'other');
  const showBrokenImage = safe && item.kind === 'image' && imageFailed;

  const thumbInner = (
    <div className={`${THUMB_CLASS} flex items-center justify-center`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN / signed URLs
        <img
          src={item.url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : null}

      {showBrokenImage ? (
        <ImageIcon
          className="h-12 w-12 text-muted-foreground"
          strokeWidth={1.25}
        />
      ) : null}

      {showVideo ? (
        <video
          src={item.url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover bg-black"
        >
          <track kind="captions" />
        </video>
      ) : null}

      {showPdfOrDocThumb ? (
        <FileIcon
          className="h-14 w-14 text-muted-foreground"
          strokeWidth={1.25}
        />
      ) : null}

      {!safe ? (
        <FileIcon
          className="h-14 w-14 text-muted-foreground"
          strokeWidth={1.25}
        />
      ) : null}
    </div>
  );

  return (
    <li className="relative flex gap-4 pb-10 last:pb-0">
      <div
        className="relative flex w-5 shrink-0 flex-col items-center"
        aria-hidden
      >
        <span className="z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-background bg-accent-9 shadow-sm ring-1 ring-border" />
        {!isLast ? (
          <span className="absolute left-1/2 top-5 bottom-0 w-px -translate-x-1/2 bg-border" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <time
          dateTime={item.uploadedAt}
          className="text-xs font-medium text-muted-foreground"
        >
          {uploaded}
        </time>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
          {contextLine}
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {safe ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex w-fit max-w-full flex-col gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={openLabel}
            >
              {thumbInner}
              <span className="inline-flex items-start gap-1.5 text-sm font-medium text-foreground underline-offset-2 group-hover:text-primary group-hover:underline">
                <span className="line-clamp-3 break-words text-left">
                  {item.name}
                </span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
              </span>
            </a>
          ) : (
            <>
              {thumbInner}
              <span className="line-clamp-3 break-words text-sm font-medium text-foreground">
                {item.name}
              </span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
