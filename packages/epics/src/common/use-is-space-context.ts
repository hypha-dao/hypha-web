'use client';

import { useParams } from 'next/navigation';

/**
 * Returns true when the current route is inside a space context
 * (i.e. /[lang]/dho/[id]/...).
 *
 * The `id` param is only defined when Next.js matches the
 * `[lang]/dho/[id]` route segment, so its presence is a reliable
 * indicator that side panels should be rendered.
 */
export function useIsSpaceContext(): boolean {
  const params = useParams<{ id?: string }>();
  return !!params?.id;
}
