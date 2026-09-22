'use client';

import { useCallback, useId, useRef, type ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { axesFromGridPointer, clampAxis } from '../wellbeing-model';
import { MouthSmiley } from './wellbeing-icons';

type RatingGridProps = {
  felt: number;
  impact: number;
  onChange: (next: { felt: number; impact: number }) => void;
  feltLowLabel: string;
  feltHighLabel: string;
  impactLowLabel: string;
  impactHighLabel: string;
  dragHint: string;
  score: number;
  variant?: 'feeling' | 'idg';
  handle?: ReactNode;
  markerClassName?: string;
};

export function RatingGrid({
  felt,
  impact,
  onChange,
  feltLowLabel,
  feltHighLabel,
  impactLowLabel,
  impactHighLabel,
  dragHint,
  score,
  variant = 'idg',
  handle,
  markerClassName,
}: RatingGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const feeling = variant === 'feeling';

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const node = gridRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      onChange(
        axesFromGridPointer(
          (clientX - rect.left) / rect.width,
          (clientY - rect.top) / rect.height,
        ),
      );
    },
    [onChange],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateFromPointer(event.clientX, event.clientY);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex items-center px-1 text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground',
          feeling ? 'justify-center' : 'justify-between',
        )}
      >
        {feeling ? null : <span />}
        <span>{impactHighLabel}</span>
        {feeling ? null : (
          <span
            className="rounded-full border border-border/70 bg-background-2 px-2 py-0.5 text-2 font-semibold normal-case tracking-normal text-foreground"
            aria-live="polite"
          >
            {score}
          </span>
        )}
      </div>
      <div className="relative">
        {feeling ? (
          <MouthSmiley
            mood="sad"
            className="pointer-events-none absolute top-1/2 left-1.5 z-10 size-6 -translate-y-1/2 text-neutral-11"
          />
        ) : null}
        {feeling ? (
          <MouthSmiley
            mood="happy"
            className="pointer-events-none absolute top-1/2 right-1.5 z-10 size-6 -translate-y-1/2 text-neutral-11"
          />
        ) : null}
        <div
          ref={gridRef}
          role="application"
          aria-labelledby={labelId}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 8 : 3;
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              onChange({ felt: clampAxis(felt - step), impact });
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              onChange({ felt: clampAxis(felt + step), impact });
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              onChange({ felt: felt, impact: clampAxis(impact + step) });
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              onChange({ felt: felt, impact: clampAxis(impact - step) });
            }
          }}
          className={cn(
            'relative aspect-square w-full cursor-crosshair touch-none overflow-hidden rounded-xl border border-border/70',
            'bg-[radial-gradient(circle_at_center,var(--color-background-3),var(--color-background-2))]',
          )}
          style={{
            backgroundImage: `
            radial-gradient(circle at ${felt}% ${
              100 - impact
            }%, color-mix(in oklab, var(--accent-9) 22%, transparent), transparent 28%),
            radial-gradient(circle, color-mix(in oklab, var(--neutral-8) 35%, transparent) 0.7px, transparent 0.8px)
          `,
            backgroundSize: 'auto, 18px 18px',
          }}
        >
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${felt}%`, top: `${100 - impact}%` }}
          >
            {handle ?? (
              <span
                className={cn(
                  'block size-5 rounded-full border-2 border-background shadow-sm',
                  markerClassName ?? 'bg-accent-9',
                )}
              />
            )}
          </span>
          <p
            id={labelId}
            className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-1 text-muted-foreground"
          >
            {dragHint}
          </p>
        </div>
      </div>
      {feeling ? (
        <div className="flex items-center justify-center px-1 text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
          <span>{impactLowLabel}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between px-1 text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
          <span>{feltLowLabel}</span>
          <span>{impactLowLabel}</span>
          <span>{feltHighLabel}</span>
        </div>
      )}
    </div>
  );
}
