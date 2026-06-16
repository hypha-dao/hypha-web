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

/** UploadThing/CDN hosts that must bypass `/_next/image` downscaling. */
const UNOPTIMIZED_REMOTE_IMAGE_HOSTS = new Set([
  'utfs.io',
  'uploadthing.com',
  'ufs.sh',
]);

function shouldUseUnoptimizedRemoteImage(src: string): boolean {
  if (!src.startsWith('http://') && !src.startsWith('https://')) {
    return false;
  }
  try {
    const hostname = new URL(src).hostname.toLowerCase();
    if (UNOPTIMIZED_REMOTE_IMAGE_HOSTS.has(hostname)) return true;
    return hostname.endsWith('.utfs.io');
  } catch {
    return false;
  }
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

  React.useEffect(() => {
    let cancelled = false;
    const image = new window.Image();

    const markReady = () => {
      if (!cancelled) setReady(true);
    };

    image.onload = () => {
      if (typeof image.decode === 'function') {
        image.decode().then(markReady).catch(markReady);
        return;
      }
      markReady();
    };

    image.onerror = () => {
      if (!cancelled) setImageFailed(true);
    };

    image.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  const parallaxY = reduceMotion ? 0 : clampParallaxScrollY(mainScrollY);
  const imageVisible = ready && !imageFailed;
  const loadedOverlayOpacity = imageVisible ? 1 : 0;
  const unoptimized = shouldUseUnoptimizedRemoteImage(src);
  const predecodePlateStyle = {
    backgroundImage:
      'radial-gradient(ellipse 140% 100% at 12% -5%, rgb(14,17,25) 0%, rgb(10,13,20) 42%, rgb(7,9,15) 68%, rgb(4,6,11) 100%)',
  };
  const predecodeGlowStyle = {
    backgroundImage:
      'radial-gradient(ellipse 55% 45% at 80% 8%, rgba(255,255,255,0.04), transparent 62%)',
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      {/* Deterministic dark-neutral predecode plate for smooth first paint in any theme. */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-320 ease-out',
          imageVisible ? 'opacity-0' : 'opacity-100',
        )}
        style={predecodePlateStyle}
        aria-hidden
      />
      <div
        className={cn(
          'absolute inset-0 mix-blend-soft-light transition-opacity duration-320 ease-out',
          imageVisible ? 'opacity-0' : 'opacity-100',
        )}
        style={predecodeGlowStyle}
        aria-hidden
      />
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-320 ease-out',
          imageVisible ? 'opacity-0' : 'opacity-100',
        )}
        style={{
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.26) 52%, rgba(0,0,0,0.08) 100%)',
        }}
        aria-hidden
      />
      {/* Taller layer + parallax translate so edges never show during scroll */}
      <div
        className="absolute inset-[-14%]"
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
            unoptimized={unoptimized}
            quality={92}
            sizes="100vw"
            className={cn(
              'object-cover object-center transition-opacity duration-320 ease-out',
              imageFailed
                ? 'pointer-events-none opacity-0'
                : imageVisible
                ? 'opacity-100'
                : 'opacity-0',
            )}
            onLoad={() => {
              if (!imageFailed) setReady(true);
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
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-320 ease-out dark:hidden"
        style={{ opacity: loadedOverlayOpacity }}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to top, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.2) 52%, rgba(0,0,0,0.08) 100%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(7,10,18,0.22), transparent, rgba(7,10,18,0.16))',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 mix-blend-soft-light"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 55% 45% at 82% 8%, rgba(255,255,255,0.15), transparent 62%)',
          }}
          aria-hidden
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 hidden transition-opacity duration-320 ease-out dark:block"
        style={{ opacity: loadedOverlayOpacity }}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to top, rgba(0,0,0,var(--banner-ov-v-bottom, 0.88)) 0%, rgba(0,0,0,var(--banner-ov-v-mid, 0.42)) var(--banner-ov-v-mid-at, 52%), rgba(0,0,0,var(--banner-ov-v-top, 0.22)) 100%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(0,0,0,var(--banner-ov-h-from, 0.58)), transparent, rgba(0,0,0,var(--banner-ov-h-to, 0.4)))',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to bottom right, color-mix(in srgb, var(--color-accent-11, var(--space-accent, #4f46e5)) calc(var(--banner-ov-accent-wash, 0.18) * 100%), transparent), transparent, transparent)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 mix-blend-soft-light"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 55% 45% at 82% 8%, rgba(209,250,229,calc(0.28 * var(--banner-ov-skylight-op, 0.9))), transparent 62%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to bottom right, rgba(255,255,255,var(--banner-ov-sheen-op, 0.05)) -10%, transparent 40%, transparent 55%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 115% 95% at 50% 72%, transparent 22%, rgba(0,18,12,calc(0.62 * var(--banner-ov-vignette-strength, 1))) 88%, rgba(0,8,5,calc(0.92 * var(--banner-ov-vignette-strength, 1))) 100%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 rounded-[inherit] mix-blend-overlay"
          style={{
            opacity: 'var(--banner-ov-grain-op, 0.055)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 rounded-[inherit]"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,var(--banner-ov-inner-top, 0.09)), inset 0 -1px 0 rgba(0,0,0,var(--banner-ov-inner-bot, 0.18))',
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}
