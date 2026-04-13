'use client';

import type { SpaceMemoryItem } from '@hypha-platform/core/client';
import { Card } from '@hypha-platform/ui';
import { ExternalLink, FileIcon, Image as ImageIcon } from 'lucide-react';
import { formatDate } from '@hypha-platform/ui-utils';
import React from 'react';

function isSafeAssetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

type SpaceMemoryAssetCardProps = {
  item: SpaceMemoryItem;
  contextLine: string;
  openLabel: string;
};

/**
 * Card + preview aligned with Human Chat attachment styling
 * (`human-chat-panel-message-bubble`: image slot + m.file card).
 */
export function SpaceMemoryAssetCard({
  item,
  contextLine,
  openLabel,
}: SpaceMemoryAssetCardProps) {
  const safe = isSafeAssetUrl(item.url);
  const uploaded = formatDate(new Date(item.uploadedAt), true);
  const [imageFailed, setImageFailed] = React.useState(false);

  return (
    <Card className="w-full overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {safe && item.kind === 'image' && !imageFailed ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block border-b border-border bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={openLabel}
        >
          <div className="relative flex max-h-56 min-h-[120px] w-full items-center justify-center overflow-hidden rounded-t-xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- CDN / signed URLs */}
            <img
              src={item.url}
              alt={item.name}
              className="max-h-56 w-full object-contain"
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          </div>
        </a>
      ) : null}

      {safe && item.kind === 'image' && imageFailed ? (
        <div className="flex min-h-[120px] w-full items-center justify-center gap-2 border-b border-border bg-muted/50 px-3 py-4 text-muted-foreground">
          <ImageIcon
            className="h-8 w-8 shrink-0 opacity-70"
            strokeWidth={1.25}
          />
          <span className="truncate text-xs">{item.name}</span>
        </div>
      ) : null}

      {safe && item.kind === 'video' ? (
        <div className="border-b border-border bg-muted/30">
          <video
            src={item.url}
            controls
            className="max-h-56 w-full bg-black object-contain"
            preload="metadata"
          >
            <track kind="captions" />
          </video>
        </div>
      ) : null}

      <div className="p-3 sm:p-4">
        {(item.kind === 'document' ||
          item.kind === 'other' ||
          !safe ||
          (item.kind === 'image' && imageFailed)) && (
          <div className="mb-3 flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <FileIcon className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              {safe ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <span className="truncate">{item.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </a>
              ) : (
                <span className="truncate text-sm font-medium text-foreground">
                  {item.name}
                </span>
              )}
            </div>
          </div>
        )}

        {item.kind === 'image' && safe && !imageFailed ? (
          <div className="mb-1 flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {item.name}
            </p>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-primary hover:opacity-80"
              aria-label={openLabel}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ) : null}

        {item.kind === 'video' && safe ? (
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {item.name}
            </p>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sm font-medium text-primary hover:underline"
            >
              <span className="sr-only">{openLabel}</span>
              <ExternalLink className="inline h-4 w-4" />
            </a>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground line-clamp-2">
          {contextLine}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{uploaded}</p>
      </div>
    </Card>
  );
}
