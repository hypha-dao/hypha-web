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
