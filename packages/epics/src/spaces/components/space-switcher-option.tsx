'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';

/** Circular space avatar from the space switcher, including its Sparkles fallback. */
export function SpaceSwitcherMark({
  iconUrl,
  alt = '',
}: {
  iconUrl?: string | null;
  alt?: string;
}) {
  return (
    <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full">
      {iconUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconUrl} alt={alt} className="h-full w-full object-cover" />
        </>
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      )}
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
>(function SpaceSwitcherOption({ title, iconUrl, className, ...props }, ref) {
  return (
    <Link
      ref={ref}
      className={cn('flex min-w-0 items-center gap-2', className)}
      {...props}
    >
      <SpaceSwitcherMark iconUrl={iconUrl} alt={title} />
      <span className="min-w-0 max-w-[11.25rem] flex-1 truncate">{title}</span>
    </Link>
  );
});

SpaceSwitcherOption.displayName = 'SpaceSwitcherOption';
