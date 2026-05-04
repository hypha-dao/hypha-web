'use client';

import * as React from 'react';
import { useMainColumnScrollY } from './main-column-scroll';

type ScrollParallaxOptions = {
  rate?: number;
  maxShiftPx?: number;
};

function clampShift(scrollY: number, rate: number, maxShiftPx: number): number {
  return Math.min(maxShiftPx, Math.max(-maxShiftPx, scrollY * rate));
}

export function useScrollParallax(options: ScrollParallaxOptions = {}) {
  const { rate = 0.12, maxShiftPx = 32 } = options;
  const mainScrollY = useMainColumnScrollY();
  const [reduceMotion, setReduceMotion] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    );
  });

  React.useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;

    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const parallaxY = reduceMotion
    ? 0
    : clampShift(mainScrollY, rate, maxShiftPx);

  return {
    reduceMotion,
    parallaxY,
  };
}
