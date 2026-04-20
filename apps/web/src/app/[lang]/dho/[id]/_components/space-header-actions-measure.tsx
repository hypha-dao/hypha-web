'use client';

import { cn } from '@hypha-platform/ui-utils';
import { type ReactNode, useEffect } from 'react';

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
 * this row aligns under MenuTop + sticky context bar (--app-subnav-h).
 */
export function SpaceHeaderActionsMeasure({
  children,
  className,
}: SpaceHeaderActionsMeasureProps) {
  const { setCompactBarActive, compactBarActive } = useSpaceHeaderMorph();

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      '[data-space-header-actions]',
    );
    if (!el) return;

    const tick = () => {
      const cs = getComputedStyle(document.documentElement);
      const menu = parseCssPx(cs.getPropertyValue('--app-menu-top-h')) || 65;
      const sub = parseCssPx(cs.getPropertyValue('--app-subnav-h')) || 0;
      const threshold = menu + sub + 1;
      const top = el.getBoundingClientRect().top;
      /* Narrow band so the fixed duplicate appears only while overlapping the sticky stack */
      const overlap = top <= threshold + 8 && top >= threshold - 14;
      setCompactBarActive(overlap);
    };

    tick();
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    const ro = new ResizeObserver(tick);
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener('scroll', tick);
      window.removeEventListener('resize', tick);
      ro.disconnect();
      setCompactBarActive(false);
    };
  }, [setCompactBarActive]);

  return (
    <div
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
