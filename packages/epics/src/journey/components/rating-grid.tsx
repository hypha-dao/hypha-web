'use client';

import { useCallback, useId, useRef } from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { clampAxis } from '../wellbeing-model';

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
  markerClassName,
}: RatingGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const node = gridRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const x = clampAxis(((clientX - rect.left) / rect.width) * 100);
      const y = clampAxis((1 - (clientY - rect.top) / rect.height) * 100);
      onChange({ felt: x, impact: y });
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
      <div className="flex items-center justify-between px-1 text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span>{impactHighLabel}</span>
        <span
          className="rounded-full border border-border/70 bg-background-2 px-2 py-0.5 text-2 font-semibold normal-case tracking-normal text-foreground"
          aria-live="polite"
        >
          {score}
        </span>
      </div>
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
          className={cn(
            'pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-sm',
            markerClassName ?? 'bg-accent-9',
          )}
          style={{ left: `${felt}%`, top: `${100 - impact}%` }}
        />
        <p
          id={labelId}
          className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-1 text-muted-foreground"
        >
          {dragHint}
        </p>
      </div>
      <div className="flex items-center justify-between px-1 text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span>{feltLowLabel}</span>
        <span>{impactLowLabel}</span>
        <span>{feltHighLabel}</span>
      </div>
    </div>
  );
}
