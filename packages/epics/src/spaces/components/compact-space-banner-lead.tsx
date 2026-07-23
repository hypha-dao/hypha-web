'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@hypha-platform/ui-utils';
import { useMainColumnScrollY } from '../../common/main-column-scroll';

type Props = {
  src: string;
};

/** Scroll factor: image moves slower than the page for depth (tuned subtle). */
const PARALLAX_SCROLL_RATE = 0.1;
const PARALLAX_MAX_SHIFT_PX = 36;

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
 *
 * Craft: calm the plate (desaturate / dim) and use a dark neutral scrim — no mint
 * skylight, accent wash, or soft-light neon amplification.
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
          'absolute inset-0 transition-opacity duration-320 ease-out',
          imageVisible ? 'opacity-0' : 'opacity-100',
        )}
        style={{
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.28) 100%)',
        }}
        aria-hidden
      />
      {/* Taller layer + parallax translate so edges never show during scroll */}
      <div
        className="absolute inset-[-10%]"
        style={
          reduceMotion
            ? undefined
            : { transform: `translate3d(0, ${parallaxY}px, 0)` }
        }
        aria-hidden
      >
        <div className="relative h-full w-full min-h-[8rem]">
          <Image
            src={src}
            alt=""
            fill
            priority
            unoptimized={unoptimized}
            quality={88}
            sizes="100vw"
            className={cn(
              /* Calm neon lead plates: dim + desaturate so space hue stays, without eye-strain blast */
              'object-cover object-center transition-opacity duration-320 ease-out',
              'brightness-[0.78] contrast-[0.96] saturate-[0.58]',
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
      {/* Shared calm scrim — readable white type without tinted neon overlays */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-320 ease-out"
        style={{ opacity: loadedOverlayOpacity }}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to top, rgba(0,0,0,var(--banner-ov-v-bottom, 0.78)) 0%, rgba(0,0,0,var(--banner-ov-v-mid, 0.52)) var(--banner-ov-v-mid-at, 48%), rgba(0,0,0,var(--banner-ov-v-top, 0.38)) 100%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(0,0,0,var(--banner-ov-h-from, 0.42)), transparent 42%, rgba(0,0,0,var(--banner-ov-h-to, 0.28)))',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 120% 90% at 50% 78%, transparent 28%, rgba(0,0,0,calc(0.45 * var(--banner-ov-vignette-strength, 1))) 100%)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 rounded-[inherit]"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,var(--banner-ov-inner-top, 0.04)), inset 0 -1px 0 rgba(0,0,0,var(--banner-ov-inner-bot, 0.22))',
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}
