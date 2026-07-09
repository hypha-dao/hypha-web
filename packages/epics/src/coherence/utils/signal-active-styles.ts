import { cn } from '@hypha-platform/ui-utils';

/** Accent ring for the signal the user is currently viewing in coherence chat. */
export function signalCardActiveClass(isActive: boolean, className?: string) {
  return cn(
    isActive &&
      'border-accent-9 ring-2 ring-accent-9/45 shadow-md [outline:none]',
    className,
  );
}

export function isSignalSlugActive(
  slug: string | null | undefined,
  activeSignalSlug: string | null | undefined,
): boolean {
  const normalized = slug?.trim();
  const active = activeSignalSlug?.trim();
  return Boolean(normalized && active && normalized === active);
}
