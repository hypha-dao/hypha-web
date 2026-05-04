'use client';

const VALID_DHO_TABS = new Set([
  'overview',
  'ecosystem-navigation',
  'coherence',
  'agreements',
  'members',
  'treasury',
  'rewards',
  'memory',
]);

type GetDhoSpaceContextPathParams = {
  pathname: string | null | undefined;
  lang: string;
  spaceSlug: string;
};

export function getDhoSpaceContextPath({
  pathname,
  lang,
  spaceSlug,
}: GetDhoSpaceContextPathParams) {
  const match = pathname?.match(/^\/[^/]+\/dho\/[^/]+(?:\/([^/]+))?/);
  const nextSegment = match?.[1];
  const activeTab =
    nextSegment && VALID_DHO_TABS.has(nextSegment) ? nextSegment : 'agreements';

  return `/${lang}/dho/${spaceSlug}/${activeTab}`;
}
