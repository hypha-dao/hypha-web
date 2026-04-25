'use client';

import {
  useCallback,
  useId,
  useRef,
  type RefObject,
  type PointerEvent,
} from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { clampCallFullViewSplit } from './call-full-view-split';

type Orientation = 'vertical' | 'horizontal';

type CallFullViewPaneSplitterProps = {
  orientation: Orientation;
  /** 0–1. Vertical: first pane width fraction. Horizontal: top pane height fraction. */
  ratio: number;
  onRatioChange: (next: number) => void;
  containerRef: RefObject<HTMLElement | null>;
  className?: string;
  lineClassName?: string;
  'aria-label': string;
};

const HIT_PX = 10;

/**
 * Draggable “green line” between screen share and participant panes in full view.
 */
export function CallFullViewPaneSplitter({
  orientation,
  ratio,
  onRatioChange,
  containerRef,
  className,
  lineClassName,
  'aria-label': ariaLabel,
}: CallFullViewPaneSplitterProps) {
  const id = useId();
  const dragRef = useRef(false);
  const applyFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (orientation === 'vertical') {
        const x = clientX - r.left;
        onRatioChange(clampCallFullViewSplit(x / Math.max(1, r.width)));
      } else {
        const y = clientY - r.top;
        onRatioChange(clampCallFullViewSplit(y / Math.max(1, r.height)));
      }
    },
    [containerRef, onRatioChange, orientation],
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = true;
    applyFromClient(e.clientX, e.clientY);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    applyFromClient(e.clientX, e.clientY);
  };

  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = false;
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      id={id}
      aria-label={ariaLabel}
      aria-orientation={orientation === 'vertical' ? 'vertical' : 'horizontal'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        const step = 0.02;
        if (e.key === 'ArrowLeft' && orientation === 'vertical') {
          e.preventDefault();
          onRatioChange(clampCallFullViewSplit(ratio - step));
        } else if (e.key === 'ArrowRight' && orientation === 'vertical') {
          e.preventDefault();
          onRatioChange(clampCallFullViewSplit(ratio + step));
        } else if (e.key === 'ArrowUp' && orientation === 'horizontal') {
          e.preventDefault();
          onRatioChange(clampCallFullViewSplit(ratio - step));
        } else if (e.key === 'ArrowDown' && orientation === 'horizontal') {
          e.preventDefault();
          onRatioChange(clampCallFullViewSplit(ratio + step));
        }
      }}
      className={cn(
        'pointer-events-auto z-20 touch-none select-none',
        orientation === 'vertical'
          ? 'absolute top-0 bottom-0 w-0 -translate-x-1/2 cursor-ew-resize'
          : 'absolute left-0 right-0 h-0 -translate-y-1/2 cursor-ns-resize',
        'focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        className,
      )}
      style={
        orientation === 'vertical'
          ? { left: `${Math.min(0.99, Math.max(0.01, ratio)) * 100}%` }
          : { top: `${Math.min(0.99, Math.max(0.01, ratio)) * 100}%` }
      }
    >
      <span
        className={cn(
          'absolute flex items-center justify-center',
          orientation === 'vertical'
            ? 'inset-y-0 w-[var(--split-hit)] -translate-x-1/2'
            : 'inset-x-0 h-[var(--split-hit)] -translate-y-1/2',
        )}
        style={{ ['--split-hit' as string]: `${HIT_PX}px` }}
        aria-hidden
      >
        <span
          className={cn(
            'shrink-0 rounded-sm bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]',
            orientation === 'vertical'
              ? 'h-[min(4rem,45%)] w-1 self-center'
              : 'h-1 w-[min(3rem,45%)]',
            lineClassName,
          )}
        />
      </span>
    </div>
  );
}
