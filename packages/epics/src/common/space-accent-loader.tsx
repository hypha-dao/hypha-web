'use client';

import { Loader2 } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

export type SpaceAccentLoaderSize = 'sm' | 'md' | 'lg';

const SPINNER_ICON: Record<SpaceAccentLoaderSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

type SpaceAccentSpinnerProps = {
  size?: SpaceAccentLoaderSize;
  className?: string;
};

/**
 * Quiet hairline spinner tinted with space accent.
 * No glow badge / pulse halo — readable in light and dark.
 */
export function SpaceAccentSpinner({
  size = 'md',
  className,
}: SpaceAccentSpinnerProps) {
  return (
    <Loader2
      className={cn(
        'motion-reduce:animate-none animate-spin text-[color:var(--space-accent,var(--color-accent-9,#4a65d8))]',
        SPINNER_ICON[size],
        className,
      )}
      strokeWidth={1.75}
      aria-hidden
    />
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
      className={cn(
        'flex flex-col items-center gap-2.5 text-center',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message ?? undefined}
    >
      <SpaceAccentSpinner size={size} />
      {shouldShowLabel ? (
        <p className="font-sans text-sm font-medium tracking-wide text-neutral-11">
          {message}
        </p>
      ) : null}
    </div>
  );
}
