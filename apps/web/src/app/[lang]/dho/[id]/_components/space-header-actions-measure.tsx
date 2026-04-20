'use client';

import { cn } from '@hypha-platform/ui-utils';
import { type ReactNode, useEffect, useRef } from 'react';

import { useSpaceHeaderMorph } from './space-header-morph-context';

function parseCssPx(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

type SpaceHeaderActionsMeasureProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Join + actions row: while scrolling into MenuTop + identity strip, a fixed mirror
 * duplicates this row; once the in-flow row is absorbed (sticky under the stack),
 * the mirror turns off — no double toolbar.
 */
export function SpaceHeaderActionsMeasure({
  children,
  className,
}: SpaceHeaderActionsMeasureProps) {
  const {
    setCompactActionsScroll,
    compactActionsMirror,
    compactActionsAbsorbed,
  } = useSpaceHeaderMorph();
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    let raf = 0;

    const measure = () => {
      const cs = getComputedStyle(document.documentElement);
      const menu = parseCssPx(cs.getPropertyValue('--app-menu-top-h')) || 65;
      const sub = parseCssPx(cs.getPropertyValue('--app-subnav-h')) || 0;
      const threshold = menu + sub + 1;
      const top = el.getBoundingClientRect().top;

      /* Row is stuck under the sticky stack */
      const absorbed = top <= threshold + 0.75;
      /* Narrow band: row overlaps stack but has not yet locked — show fixed mirror */
      const mirror =
        !absorbed && top <= threshold + 18 && top >= threshold - 22;

      setCompactActionsScroll(mirror, absorbed);
    };

    const tick = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    measure();
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    const ro = new ResizeObserver(tick);
    ro.observe(document.documentElement);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', tick);
      window.removeEventListener('resize', tick);
      ro.disconnect();
      setCompactActionsScroll(false, false);
    };
  }, [setCompactActionsScroll]);

  return (
    <div
      ref={rowRef}
      data-space-header-actions
      className={cn(
        'sticky z-[28] flex flex-wrap justify-end gap-2 border-b border-border bg-background-2 py-2.5 sm:py-3',
        className,
        compactActionsMirror &&
          'pointer-events-none invisible select-none opacity-0',
        compactActionsAbsorbed && 'visible opacity-100',
      )}
      style={{
        top: `calc(var(--app-menu-top-h, 65px) + var(--app-subnav-h, 0px))`,
      }}
      aria-hidden={compactActionsMirror || undefined}
    >
      {children}
    </div>
  );
}
