'use client';

const VALID_DHO_TABS = new Set([
  'highlights',
  'overview',
  'ecosystem-navigation',
  'coherence',
  'agreements',
  'members',
  'calendar',
  'treasury',
  'banking',
  'rewards',
  'memory',
]);

type GetDhoSpaceContextPathParams = {
  pathname: string | null | undefined;
  lang: string;
  spaceSlug: string;
};

export function getDhoSpaceContextPath(
  params: Omit<GetDhoSpaceContextPathParams, 'pathname'> & { pathname: string },
): string;
export function getDhoSpaceContextPath(
  params: Omit<GetDhoSpaceContextPathParams, 'pathname'> & {
    pathname: null | undefined;
  },
): null | undefined;
export function getDhoSpaceContextPath({
  pathname,
  lang,
  spaceSlug,
}: GetDhoSpaceContextPathParams) {
  if (pathname == null) {
    return pathname;
  }

  const match = pathname.match(/^\/[^/]+\/dho\/[^/]+(?:\/([^/]+))?/);
  if (!match) {
    return pathname;
  }

  const nextSegment = match?.[1];
  const activeTab =
    nextSegment && VALID_DHO_TABS.has(nextSegment) ? nextSegment : 'agreements';

  return `/${lang}/dho/${spaceSlug}/${activeTab}`;
}
