'use client';

import { useParams, usePathname } from 'next/navigation';

import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';

/**
 * Returns true when the current route is inside a space context
 * (i.e. /[lang]/dho/[id]/...).
 *
 * Prefer pathname when `useParams().id` is missing — the AI panel mounts in
 * the root layout where nested dynamic params are not always populated.
 */
export function useIsSpaceContext(): boolean {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  return Boolean(params?.id ?? getDhoSpaceSlugFromPathname(pathname));
}

/** `/{lang}/connections`. A space slug of "connections" does not match. */
export function isConnectionsPath(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  return /^\/[^/]+\/connections(?:\/|$)/.test(pathname);
}

/** `/{lang}/network` and its sections. A space slug of "network" does not match. */
export function isNetworkPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return /^\/[^/]+\/network(?:\/|$)/.test(pathname);
}

export function useIsNetworkContext(): boolean {
  const pathname = usePathname();
  return isNetworkPath(pathname);
}
