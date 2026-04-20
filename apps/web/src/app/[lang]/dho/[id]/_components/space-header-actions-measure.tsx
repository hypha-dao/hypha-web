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
 * Wraps the below-banner Join + ActionButtons row; sets compact bar visibility when
 * this row aligns under MenuTop (--app-subnav-h is 0 when breadcrumbs live in the hero).
 */
export function SpaceHeaderActionsMeasure({
  children,
  className,
}: SpaceHeaderActionsMeasureProps) {
  const { setCompactBarActive, compactBarActive } = useSpaceHeaderMorph();
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
      /* Narrow band so the fixed duplicate appears only while overlapping the sticky stack */
      const overlap = top <= threshold + 8 && top >= threshold - 14;
      setCompactBarActive(overlap);
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
      setCompactBarActive(false);
    };
  }, [setCompactBarActive]);

  return (
    <div
      ref={rowRef}
      data-space-header-actions
      className={cn(
        className,
        compactBarActive &&
          'pointer-events-none invisible select-none opacity-0',
      )}
      aria-hidden={compactBarActive || undefined}
    >
      {children}
    </div>
  );
}
