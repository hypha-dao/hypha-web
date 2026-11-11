import type { SpaceContextSectionKey } from '@hypha-platform/core/client';

/** Ratification form for the space, optionally preselecting sections. */
export function spaceContextProposeHref(
  locale: string,
  spaceSlug: string,
  sectionKeys: SpaceContextSectionKey[] = [],
): string {
  const href = `/${locale}/dho/${spaceSlug}/context/create`;
  if (sectionKeys.length === 0) return href;
  const query = new URLSearchParams({ sections: sectionKeys.join(',') });
  return `${href}?${query.toString()}`;
}
