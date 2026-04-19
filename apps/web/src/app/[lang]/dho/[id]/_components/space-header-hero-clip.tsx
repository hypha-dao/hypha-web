'use client';

import { useSpaceHeaderMorph } from './space-header-morph-context';
import { cn } from '@hypha-platform/ui-utils';

type SpaceHeaderHeroClipProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Clips the hero media from the top as scroll progress increases —
 * reads as the fixed menu "eating" the banner.
 */
export function SpaceHeaderHeroClip({
  children,
  className,
}: SpaceHeaderHeroClipProps) {
  const { progress, reducedMotion } = useSpaceHeaderMorph();
  const eat = reducedMotion ? 0 : progress;

  return (
    <div
      className={cn('overflow-hidden rounded-2xl', className)}
      style={{
        clipPath:
          eat > 0.001 ? `inset(${eat * 62}% 0 0 0 round 1rem)` : undefined,
        transition: reducedMotion ? undefined : 'clip-path 0.12s ease-out',
      }}
    >
      {children}
    </div>
  );
}
