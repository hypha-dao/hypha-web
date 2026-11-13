'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { OptimizedAvatarImage } from '../../common/optimized-avatar-image';
import { useEnergyOverviewIdleGate } from '../../common/use-after-idle';

/** Circular space avatar from the space switcher, including its Sparkles fallback. */
export function SpaceSwitcherMark({
  iconUrl,
  alt = '',
}: {
  iconUrl?: string | null;
  alt?: string;
}) {
  return (
    <span
      className="shrink-0 overflow-hidden rounded-full"
      style={{ width: 24, height: 24 }}
    >
      <OptimizedAvatarImage
        src={iconUrl ?? undefined}
        alt={alt}
        pixelSize={24}
        className="h-full w-full object-cover"
        fallback={
          <span className="flex h-full w-full items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        }
      />
    </span>
  );
}

/**
 * One row from the space switcher menu: circular avatar and space name.
 */
export const SpaceSwitcherOption = forwardRef<
  HTMLAnchorElement,
  Omit<React.ComponentPropsWithoutRef<typeof Link>, 'children'> & {
    title: string;
    iconUrl?: string | null;
  }
>(function SpaceSwitcherOption(
  { title, iconUrl, className, prefetch, ...props },
  ref,
) {
  const prefetchNav = useEnergyOverviewIdleGate();
  return (
    <Link
      ref={ref}
      {...props}
      prefetch={prefetch ?? prefetchNav}
      className={cn('flex w-full min-w-0 items-center gap-2', className)}
      style={{ minHeight: 32 }}
    >
      <SpaceSwitcherMark iconUrl={iconUrl} alt={title} />
      <span className="min-w-0 flex-1 truncate">{title}</span>
    </Link>
  );
});

SpaceSwitcherOption.displayName = 'SpaceSwitcherOption';
