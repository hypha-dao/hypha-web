'use client';

import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useEffect, useRef, useState } from 'react';

import { useSpaceHeaderMorph } from './space-header-morph-context';

type SpaceHeaderAvatarProps = {
  src: string;
};

/**
 * Left-edge avatar with scroll-driven motion: parallax + scales toward compact row.
 */
export function SpaceHeaderAvatar({ src }: SpaceHeaderAvatarProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [parallaxY, setParallaxY] = useState(0);
  const { progress, reducedMotion } = useSpaceHeaderMorph();

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduceMotion) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const bannerMidY = rect.top + rect.height / 2;
      const viewMid = vh / 2;
      const normalised = (bannerMidY - viewMid) / vh;
      /* Subtle drift — avoids fighting scroll / sticky chrome */
      setParallaxY(Math.max(-14, Math.min(14, -normalised * 22)));
    };

    const onScrollOrResize = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* End at 32px (h-8) — same size as fixed identity avatar */
  const morphScale = reducedMotion ? 1 : Math.max(0.25, 1 - progress * 0.75);
  const morphY = reducedMotion ? 0 : progress * -52;

  return (
    <div
      ref={bannerRef}
      className="pointer-events-none absolute inset-0 z-[15] overflow-visible"
      aria-hidden
    >
      <div
        className={cn(
          'pointer-events-auto absolute top-1/2 left-0',
          !reducedMotion && 'will-change-transform',
        )}
        style={{
          transform: `translate(-34%, calc(-50% + ${parallaxY}px + ${morphY}px)) scale(${morphScale})`,
          transformOrigin: 'center center',
          opacity: reducedMotion ? 1 : Math.max(0, 1 - progress * 1.05),
        }}
      >
        <Avatar
          className={cn(
            'h-[128px] w-[128px] rounded-full',
            'shadow-[0_22px_52px_-14px_rgba(0,0,0,0.88)]',
          )}
        >
          <AvatarImage src={src} alt="" aria-hidden className="object-cover" />
        </Avatar>
      </div>
    </div>
  );
}
