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

const HIT_PX = 12;

/**
 * Draggable emerald divider between screen share and participant panes.
 * Hit target is centered on `ratio`; the visible line shares that center (no double translate).
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
  const clamped = Math.min(0.99, Math.max(0.01, ratio));

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

  const hitOffset = HIT_PX / 2;

  return (
    <div
      role="separator"
      tabIndex={0}
      id={id}
      aria-label={ariaLabel}
      aria-orientation={orientation === 'vertical' ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(clamped * 100)}
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
        'pointer-events-auto absolute z-20 touch-none select-none',
        orientation === 'vertical' ? 'cursor-ew-resize' : 'cursor-ns-resize',
        'focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        className,
      )}
      style={
        orientation === 'vertical'
          ? {
              left: `${clamped * 100}%`,
              top: 0,
              bottom: 0,
              width: HIT_PX,
              marginLeft: -hitOffset,
            }
          : {
              top: `${clamped * 100}%`,
              left: 0,
              right: 0,
              height: HIT_PX,
              marginTop: -hitOffset,
            }
      }
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.45)]',
          orientation === 'vertical'
            ? 'bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2'
            : 'left-0 right-0 top-1/2 h-0.5 -translate-y-1/2',
          lineClassName,
        )}
      />
    </div>
  );
}
