'use client';

import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useEffect, useRef, useState } from 'react';

type SpaceHeaderAvatarProps = {
  src: string;
};

/**
 * Left-edge avatar, vertically centred on the banner, bleeding slightly past
 * the left border. Subtle scroll-based parallax (respects prefers-reduced-motion).
 */
export function SpaceHeaderAvatar({ src }: SpaceHeaderAvatarProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [parallaxY, setParallaxY] = useState(0);

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
      /* Small opposite drift — reads as depth without gimmicks */
      setParallaxY(Math.max(-12, Math.min(12, -normalised * 16)));
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

  return (
    <div
      ref={bannerRef}
      className="pointer-events-none absolute inset-0 z-[15] overflow-visible"
      aria-hidden
    >
      <div
        className="pointer-events-auto absolute top-1/2 left-0 will-change-transform"
        style={{
          transform: `translate(-34%, calc(-50% + ${parallaxY}px))`,
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
