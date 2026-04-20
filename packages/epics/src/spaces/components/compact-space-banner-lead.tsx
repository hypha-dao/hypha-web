'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@hypha-platform/ui-utils';

type Props = {
  src: string;
};

/** Scroll factor: image moves slower than the page for depth (tuned subtle → noticeable). */
const PARALLAX_SCROLL_RATE = 0.14;
const PARALLAX_MAX_SHIFT_PX = 56;

/**
 * Hero lead image with stable branded placeholder + fade-in.
 * Avoids the grey flash from CSS background-image decoding on first paint.
 * Optional scroll parallax on the photo layer (overlays stay fixed for readable text).
 */
export function CompactSpaceBannerLead({ src }: Props) {
  const [ready, setReady] = React.useState(false);
  const [parallaxY, setParallaxY] = React.useState(0);
  const [preferReducedMotion, setPreferReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;

    const sync = () => setPreferReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  React.useEffect(() => {
    if (preferReducedMotion) return;

    let raf = 0;

    const tick = () => {
      const y = Math.min(
        PARALLAX_MAX_SHIFT_PX,
        Math.max(-PARALLAX_MAX_SHIFT_PX, window.scrollY * PARALLAX_SCROLL_RATE),
      );
      setParallaxY(y);
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };

    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [preferReducedMotion]);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      {/* Same atmosphere as no-lead fallback — visible until decode */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_140%_100%_at_12%_-5%,rgb(41,115,78)_0%,rgb(14,54,38)_42%,rgb(7,38,26)_68%,rgb(2,14,10)_100%)]"
        aria-hidden
      />
      {/* Taller layer + parallax translate so edges never show during scroll */}
      <div
        className="absolute left-0 right-0 top-[-12%] h-[124%] will-change-transform"
        style={
          preferReducedMotion
            ? undefined
            : { transform: `translate3d(0, ${parallaxY}px, 0)` }
        }
        aria-hidden
      >
        <div className="relative h-full w-full min-h-[12rem]">
          <Image
            src={src}
            alt=""
            fill
            priority
            sizes="(max-width: 1280px) 100vw, min(1280px, 100vw)"
            className={cn(
              'object-cover object-center transition-opacity duration-500 ease-out',
              ready ? 'opacity-100' : 'opacity-0',
            )}
            onLoadingComplete={() => setReady(true)}
          />
        </div>
      </div>
    </div>
  );
}
