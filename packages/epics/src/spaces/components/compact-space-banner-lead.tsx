'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@hypha-platform/ui-utils';
import { useMainColumnScrollY } from '../../common/main-column-scroll';

type Props = {
  src: string;
};

/** Scroll factor: image moves slower than the page for depth (tuned subtle → noticeable). */
const PARALLAX_SCROLL_RATE = 0.14;
const PARALLAX_MAX_SHIFT_PX = 56;

function clampParallaxScrollY(scrollY: number): number {
  return Math.min(
    PARALLAX_MAX_SHIFT_PX,
    Math.max(-PARALLAX_MAX_SHIFT_PX, scrollY * PARALLAX_SCROLL_RATE),
  );
}

/**
 * Hero lead image with stable branded placeholder + fade-in.
 * Avoids the grey flash from CSS background-image decoding on first paint.
 * Optional scroll parallax on the photo layer (overlays stay fixed for readable text).
 */
export function CompactSpaceBannerLead({ src }: Props) {
  const [ready, setReady] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const mainScrollY = useMainColumnScrollY();
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    setReady(false);
    setImageFailed(false);
  }, [src]);

  React.useLayoutEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;

    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const parallaxY = reduceMotion ? 0 : clampParallaxScrollY(mainScrollY);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      {/* Same atmosphere as no-lead fallback — visible until decode */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_140%_100%_at_12%_-5%,rgb(166,206,184)_0%,rgb(123,174,147)_42%,rgb(92,145,121)_68%,rgb(68,118,98)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 mix-blend-soft-light opacity-65 bg-[radial-gradient(ellipse_50%_40%_at_80%_5%,rgba(167,243,208,0.22),transparent_60%)]"
        aria-hidden
      />
      {/* Taller layer + parallax translate so edges never show during scroll */}
      <div
        className="absolute left-0 right-0 top-[-12%] h-[124%] will-change-transform"
        style={
          reduceMotion
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
              imageFailed
                ? 'pointer-events-none opacity-0'
                : ready
                ? 'opacity-100'
                : 'opacity-0',
            )}
            onLoad={() => {
              setReady(true);
            }}
            onError={() => {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(
                  '[CompactSpaceBannerLead] lead image failed to load',
                  {
                    src,
                  },
                );
              }
              setImageFailed(true);
            }}
          />
        </div>
      </div>
      {ready && !imageFailed ? (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to top, rgba(0,0,0,var(--banner-ov-v-bottom, 0.88)) 0%, rgba(0,0,0,var(--banner-ov-v-mid, 0.42)) var(--banner-ov-v-mid-at, 52%), rgba(0,0,0,var(--banner-ov-v-top, 0.22)) 100%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(0,0,0,var(--banner-ov-h-from, 0.58)), transparent, rgba(0,0,0,var(--banner-ov-h-to, 0.4)))',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to bottom right, color-mix(in srgb, var(--color-accent-11, var(--space-accent, #4f46e5)) calc(var(--banner-ov-accent-wash, 0.18) * 100%), transparent), transparent, transparent)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 55% 45% at 82% 8%, rgba(209,250,229,calc(0.28 * var(--banner-ov-skylight-op, 0.9))), transparent 62%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to bottom right, rgba(255,255,255,var(--banner-ov-sheen-op, 0.05)) -10%, transparent 40%, transparent 55%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 115% 95% at 50% 72%, transparent 22%, rgba(0,18,12,calc(0.62 * var(--banner-ov-vignette-strength, 1))) 88%, rgba(0,8,5,calc(0.92 * var(--banner-ov-vignette-strength, 1))) 100%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay"
            style={{
              opacity: 'var(--banner-ov-grain-op, 0.055)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,var(--banner-ov-inner-top, 0.09)), inset 0 -1px 0 rgba(0,0,0,var(--banner-ov-inner-bot, 0.18))',
            }}
            aria-hidden
          />
        </>
      ) : null}
    </div>
  );
}
