'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { cn } from '@hypha-platform/ui-utils';

import {
  computeScreenshareFilmstripTileHeight,
  resolveScreenshareFilmstripContentWidth,
  resolveScreenshareFilmstripTilesPerPage,
  SCREENSHARE_FILMSTRIP,
} from './call-screenshare-filmstrip-geometry';

type RemoteTileItem =
  | { kind: 'feed'; feed: CallFeed }
  | { kind: 'placeholder'; userId: string };

function filmstripTileKey(item: RemoteTileItem, index: number): string {
  return item.kind === 'feed'
    ? `feed-${item.feed.stream?.id ?? index}-${index}`
    : `ph-filmstrip-${item.userId}-${index}`;
}

type CallPresenterParticipantFilmstripProps = {
  tiles: RemoteTileItem[];
  renderTile: (item: RemoteTileItem, keyIdx: number) => ReactNode;
  pageLabel: (current: number, total: number) => string;
  previousPageLabel: string;
  nextPageLabel: string;
  className?: string;
  contentWidth?: number;
  /** Document PiP — show every participant by splitting stage height evenly. */
  stackAllTiles?: boolean;
};

/**
 * Zoom-style vertical participant strip while the local user presents.
 * Tiles stack in a single column; paginates once the stage height is full.
 */
export function CallPresenterParticipantFilmstrip({
  tiles,
  renderTile,
  pageLabel,
  previousPageLabel,
  nextPageLabel,
  className,
  contentWidth: contentWidthProp,
  stackAllTiles = false,
}: CallPresenterParticipantFilmstripProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(0);
  const [galleryPage, setGalleryPage] = useState(0);
  const contentWidth =
    contentWidthProp ?? resolveScreenshareFilmstripContentWidth();
  const tileHeight = computeScreenshareFilmstripTileHeight(contentWidth);
  const useStackLayout = stackAllTiles && tiles.length > 0 && tiles.length <= 3;

  useEffect(() => {
    setGalleryPage(0);
  }, [tiles.length]);

  useEffect(() => {
    if (useStackLayout) return;
    const element = stageRef.current;
    if (!element) return;
    const update = () => {
      setStageHeight(element.clientHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [useStackLayout]);

  const pageCount = useMemo(() => {
    if (useStackLayout) return 1;
    if (stageHeight <= 0) return 1;
    const tentativePageSize = resolveScreenshareFilmstripTilesPerPage({
      stageHeight,
      contentWidth,
      needsPagination: false,
    });
    return Math.max(1, Math.ceil(tiles.length / tentativePageSize));
  }, [contentWidth, stageHeight, tiles.length, useStackLayout]);

  const tilesPerPage = useMemo(() => {
    if (useStackLayout) return tiles.length;
    if (stageHeight <= 0) return Math.max(1, tiles.length);
    return resolveScreenshareFilmstripTilesPerPage({
      stageHeight,
      contentWidth,
      needsPagination: pageCount > 1,
    });
  }, [contentWidth, pageCount, stageHeight, tiles.length, useStackLayout]);

  useEffect(() => {
    setGalleryPage((page) => Math.min(page, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const visibleTiles = useMemo(() => {
    if (useStackLayout || pageCount <= 1) return tiles;
    const start = galleryPage * tilesPerPage;
    return tiles.slice(start, start + tilesPerPage);
  }, [galleryPage, pageCount, tiles, tilesPerPage, useStackLayout]);

  if (useStackLayout) {
    return (
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          className,
        )}
        role="group"
        aria-label="Participants"
      >
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1.5"
          style={{ gap: SCREENSHARE_FILMSTRIP.tileGapPx }}
        >
          {tiles.map((item, index) => (
            <div
              key={filmstripTileKey(item, index)}
              className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-sm bg-black"
            >
              {renderTile(item, 1000 + index)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        className,
      )}
      role="group"
      aria-label="Participants"
    >
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden p-1.5"
        style={{ gap: SCREENSHARE_FILMSTRIP.tileGapPx }}
      >
        {visibleTiles.map((item, index) => {
          const tileIndex =
            pageCount > 1 ? galleryPage * tilesPerPage + index : index;
          return (
            <div
              key={filmstripTileKey(item, tileIndex)}
              className="relative w-full min-w-0 shrink-0 overflow-hidden rounded-sm bg-black"
              style={{ height: tileHeight }}
            >
              {renderTile(item, 1000 + tileIndex)}
            </div>
          );
        })}
      </div>
      {pageCount > 1 ? (
        <div
          data-call-interactive
          className="pointer-events-auto flex shrink-0 items-center justify-center gap-1 border-t border-border/30 px-1.5 py-1 text-[11px] text-zinc-200"
        >
          <button
            type="button"
            data-call-interactive
            className="inline-flex h-7 w-7 touch-manipulation items-center justify-center rounded-md border border-border/40 transition hover:bg-white/10 disabled:opacity-40"
            disabled={galleryPage <= 0}
            onClick={() => setGalleryPage((page) => Math.max(0, page - 1))}
            aria-label={previousPageLabel}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[4.5rem] text-center tabular-nums">
            {pageLabel(galleryPage + 1, pageCount)}
          </span>
          <button
            type="button"
            data-call-interactive
            className="inline-flex h-7 w-7 touch-manipulation items-center justify-center rounded-md border border-border/40 transition hover:bg-white/10 disabled:opacity-40"
            disabled={galleryPage >= pageCount - 1}
            onClick={() =>
              setGalleryPage((page) => Math.min(pageCount - 1, page + 1))
            }
            aria-label={nextPageLabel}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
