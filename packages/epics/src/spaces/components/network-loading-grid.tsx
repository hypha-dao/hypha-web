'use client';

import type { ReactNode } from 'react';
import { Wave } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

type NetworkLoadingGridProps = {
  count?: number;
  cardGridClassName?: string;
};

/** A space card, not a home bar: banner, mark, then text. Same sweep. */
function SpaceCardPlaceholder({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div className="craft-card flex h-full w-full flex-col" aria-hidden>
      <Wave className="h-[120px] w-full" delayMs={delayMs} />
      <div className="relative flex flex-1 flex-col gap-2 p-3.5 pt-4">
        <Wave
          className="absolute -top-12 size-14 rounded-full"
          delayMs={delayMs + 40}
        />
        <Wave className="mt-1 h-5 w-2/3" delayMs={delayMs + 80} />
        <Wave className="h-3 w-full" delayMs={delayMs + 120} />
        <Wave className="h-3 w-4/5" delayMs={delayMs + 160} />
        <div className="mt-auto flex items-center gap-3 pt-3">
          <Wave className="h-3 w-16" delayMs={delayMs + 200} />
          <Wave className="h-3 w-16" delayMs={delayMs + 240} />
          <Wave className="h-3 w-20" delayMs={delayMs + 280} />
        </div>
      </div>
    </div>
  );
}

/** Tag chip row under the search field. */
function TagRowPlaceholder() {
  const widths = [
    '4.5rem',
    '5.5rem',
    '4rem',
    '6rem',
    '5rem',
    '4.25rem',
    '5.25rem',
  ];
  return (
    <div className="flex flex-wrap justify-center gap-2" aria-hidden>
      {widths.map((width, index) => (
        <Wave
          key={width}
          className="h-7"
          delayMs={80 + index * 40}
          style={{ width }}
        />
      ))}
    </div>
  );
}

/** Four census columns — Spaces / Members / Agreements / Tokens. */
function CensusPlaceholder() {
  return (
    <div className="grid w-full grid-cols-2 md:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'flex min-w-0 flex-col items-start py-3 max-md:pr-0',
            'md:items-center md:px-4 md:py-2 md:text-center',
            index % 2 === 0 && 'max-md:pr-4',
            index % 2 === 1 &&
              'max-md:border-l max-md:border-border max-md:pl-4',
            index >= 2 && 'max-md:border-t max-md:border-border',
            index > 0 && 'md:border-l md:border-border',
          )}
        >
          <Wave
            className="h-10 w-24 md:h-12 md:w-28"
            delayMs={120 + index * 60}
          />
          <Wave className="mt-2 h-3 w-16" delayMs={160 + index * 60} />
          <Wave className="mt-1 h-2.5 w-20" delayMs={200 + index * 60} />
        </div>
      ))}
    </div>
  );
}

type MapPin = {
  x: number;
  y: number;
  size: 'dot' | 'sm' | 'md' | 'lg';
  delayMs: number;
};

/** Pin layout mirrors a flat directory map — clusters and sparse dots. */
const MAP_PINS: MapPin[] = [
  { x: 18, y: 34, size: 'lg', delayMs: 120 },
  { x: 22, y: 42, size: 'sm', delayMs: 160 },
  { x: 26, y: 38, size: 'dot', delayMs: 180 },
  { x: 28, y: 48, size: 'sm', delayMs: 200 },
  { x: 24, y: 58, size: 'sm', delayMs: 220 },
  { x: 30, y: 68, size: 'dot', delayMs: 240 },
  { x: 34, y: 72, size: 'dot', delayMs: 260 },
  { x: 48, y: 32, size: 'md', delayMs: 280 },
  { x: 50, y: 38, size: 'lg', delayMs: 300 },
  { x: 53, y: 42, size: 'sm', delayMs: 320 },
  { x: 47, y: 44, size: 'sm', delayMs: 340 },
  { x: 56, y: 48, size: 'md', delayMs: 360 },
  { x: 58, y: 54, size: 'md', delayMs: 380 },
  { x: 54, y: 62, size: 'sm', delayMs: 400 },
  { x: 68, y: 36, size: 'dot', delayMs: 420 },
  { x: 72, y: 44, size: 'dot', delayMs: 440 },
  { x: 78, y: 40, size: 'dot', delayMs: 460 },
  { x: 82, y: 52, size: 'sm', delayMs: 480 },
  { x: 84, y: 72, size: 'sm', delayMs: 500 },
  { x: 88, y: 76, size: 'sm', delayMs: 520 },
  { x: 92, y: 58, size: 'sm', delayMs: 540 },
];

/**
 * Map plane drawn like the directory: continent outlines, cluster pins, and
 * corner chrome — not a blank shimmer box.
 */
export function NetworkMapWave({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-[2/1] w-full overflow-hidden border border-border bg-background',
        className,
      )}
      aria-hidden
    >
      <Wave className="absolute inset-0 opacity-40" text={false} />
      <svg
        viewBox="0 0 100 50"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full text-neutral-7"
      >
        {/* Simplified land silhouettes — hairline continents on the ocean plane. */}
        <g
          fill="color-mix(in srgb, var(--foreground) 4%, transparent)"
          stroke="currentColor"
          strokeWidth="0.35"
          strokeLinejoin="round"
        >
          <path d="M8 18c2-4 7-7 14-6 5 1 9 4 11 8 1 3-1 7-4 9-4 3-10 4-15 2-4-2-7-7-6-13z" />
          <path d="M22 30c2-1 5 1 6 5 1 5-1 10-4 13-3 2-7 1-9-2-2-4-1-9 1-12 1-2 3-3 6-4z" />
          <path d="M46 16c3-2 7-2 10 0 3 2 4 6 3 9-2 4-6 6-10 5-4-1-6-5-5-9 0-2 1-4 2-5z" />
          <path d="M48 28c3-1 6 1 8 5 2 5 1 11-2 14-3 2-7 2-9-1-3-4-2-9 0-13 1-2 2-4 3-5z" />
          <path d="M58 14c6-3 14-3 20 0 5 2 9 7 10 13 0 5-3 9-8 11-7 3-16 2-22-2-4-3-6-8-5-13 1-4 3-7 5-9z" />
          <path d="M78 34c3-1 6 0 8 3 2 3 2 7 0 9-3 3-7 3-10 1-2-2-3-5-2-8 1-2 2-4 4-5z" />
          <path d="M88 28c2-1 4 0 5 2 1 2 0 4-2 5-2 1-4 0-5-2 0-2 0-4 2-5z" />
        </g>
      </svg>

      {MAP_PINS.map((pin) => {
        const px =
          pin.size === 'lg'
            ? 28
            : pin.size === 'md'
            ? 22
            : pin.size === 'sm'
            ? 18
            : 8;
        return (
          <span
            key={`${pin.x}-${pin.y}-${pin.size}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          >
            {pin.size === 'dot' ? (
              <Wave
                className="size-2 rounded-full"
                delayMs={pin.delayMs}
                text={false}
              />
            ) : (
              <span className="relative grid place-items-center">
                <Wave
                  className="rounded-full"
                  delayMs={pin.delayMs}
                  text={false}
                  style={{ width: px + 8, height: px + 8, opacity: 0.35 }}
                />
                <Wave
                  className="absolute rounded-full"
                  delayMs={pin.delayMs + 40}
                  text={false}
                  style={{ width: px, height: px }}
                />
              </span>
            )}
          </span>
        );
      })}

      <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
        <Wave className="h-2.5 w-16" delayMs={560} />
        <Wave className="h-2.5 w-12" delayMs={600} />
      </div>
      <div className="absolute right-3 bottom-3 flex flex-col gap-1">
        <Wave className="size-7" delayMs={580} text={false} />
        <Wave className="size-7" delayMs={620} text={false} />
      </div>
    </div>
  );
}

/** Loading grid shaped like the space cards on the explore page. */
export function NetworkLoadingGrid({
  count = 12,
  cardGridClassName,
}: NetworkLoadingGridProps) {
  return (
    <div
      className={cn('grid w-full grid-cols-1 gap-4', cardGridClassName)}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <SpaceCardPlaceholder key={index} delayMs={index * 70} />
      ))}
    </div>
  );
}

const CARD_GRID = 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

/**
 * Full directory wait mask — search, tags, census, map, and cards in the same
 * positions as the loaded network page.
 */
export function NetworkDirectoryMask({
  view,
  title,
}: {
  view?: string;
  title?: ReactNode;
}) {
  const showMap = view !== 'list';
  const showCards = view !== 'map';

  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true">
      <div className="flex min-w-0 flex-col gap-4 xl:gap-9">
        {title}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex w-full min-w-0 flex-row items-center gap-3">
            <Wave className="h-10 min-w-0 flex-1" delayMs={40} text={false} />
            <Wave className="h-10 w-28 shrink-0" delayMs={80} text={false} />
          </div>
          <TagRowPlaceholder />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {showMap ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1 border border-border p-0.5">
                <Wave className="h-8 w-24" delayMs={100} text={false} />
                <Wave className="h-8 w-16" delayMs={140} text={false} />
                <Wave className="h-8 w-16" delayMs={180} text={false} />
              </div>
              <Wave className="h-8 w-28" delayMs={160} text={false} />
            </div>
            <div className="my-6">
              <CensusPlaceholder />
            </div>
            <NetworkMapWave className="mb-7" />
          </>
        ) : null}

        {showCards ? (
          <>
            <div className="mb-7 flex w-full flex-row items-center justify-between gap-2">
              <Wave className="h-4 w-40" delayMs={200} />
              <Wave className="h-8 w-36" delayMs={240} text={false} />
            </div>
            <NetworkLoadingGrid count={8} cardGridClassName={CARD_GRID} />
          </>
        ) : null}
      </div>
    </div>
  );
}
