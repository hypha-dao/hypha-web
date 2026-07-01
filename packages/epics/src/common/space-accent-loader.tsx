'use client';

import { Loader2 } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

export type SpaceAccentLoaderSize = 'sm' | 'md' | 'lg';

const SPINNER_SIZE: Record<
  SpaceAccentLoaderSize,
  { container: string; icon: string; inset: string }
> = {
  sm: { container: 'h-8 w-8', icon: 'h-4 w-4', inset: 'inset-[2px]' },
  md: { container: 'h-11 w-11', icon: 'h-5 w-5', inset: 'inset-[3px]' },
  lg: { container: 'h-14 w-14', icon: 'h-7 w-7', inset: 'inset-[4px]' },
};

type SpaceAccentSpinnerProps = {
  size?: SpaceAccentLoaderSize;
  className?: string;
};

/** Accent ring + spinner — matches Human Chat room loading. */
export function SpaceAccentSpinner({
  size = 'md',
  className,
}: SpaceAccentSpinnerProps) {
  const dimensions = SPINNER_SIZE[size];

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        dimensions.container,
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 animate-pulse rounded-full bg-[color:color-mix(in_srgb,var(--space-accent,#4a65d8)_22%,transparent)]" />
      <div
        className={cn(
          'absolute rounded-full border border-[color:color-mix(in_srgb,var(--space-accent,#4a65d8)_35%,transparent)]',
          dimensions.inset,
        )}
      />
      <Loader2
        className={cn(
          'animate-spin text-[color:var(--space-accent,#4a65d8)]',
          dimensions.icon,
        )}
        strokeWidth={2.25}
      />
    </div>
  );
}

type SpaceAccentLoaderProps = SpaceAccentSpinnerProps & {
  label?: string;
  showLabel?: boolean;
};

/** Centered accent loader with optional label — matches Human Chat room loading. */
export function SpaceAccentLoader({
  label,
  showLabel = true,
  size = 'md',
  className,
}: SpaceAccentLoaderProps) {
  const message = label?.trim();
  const shouldShowLabel = showLabel && Boolean(message);

  return (
    <div
      className={cn('flex flex-col items-center gap-3 text-center', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message ?? undefined}
    >
      <SpaceAccentSpinner size={size} />
      {shouldShowLabel ? (
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
