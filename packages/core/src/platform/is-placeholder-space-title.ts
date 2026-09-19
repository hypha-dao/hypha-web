/**
 * Test / unmapped placeholders such as "Space 224" (default title for a
 * web3 space id with no real org name). Excluded from paying-spaces KPIs,
 * monthly aggregation, and the space filter list.
 */
const PLACEHOLDER_SPACE_TITLE = /^space \d+$/i;

export function normalizePayingSpaceTitle(title: string): string {
  return title
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\s\u00A0\u202F\u2007\u2060]+/g, ' ')
    .trim();
}

export function isPlaceholderSpaceTitle(title: string): boolean {
  return PLACEHOLDER_SPACE_TITLE.test(normalizePayingSpaceTitle(title));
}

/**
 * Public network-dashboard space filter. Same placeholder rule as paying
 * spaces, plus empty titles (which paying-spaces resolve to `Space {id}`).
 * SQL in `find-network-dashboard-stats` must stay in sync.
 */
export function isExcludedNetworkSpaceTitle(title: string): boolean {
  const normalized = normalizePayingSpaceTitle(title);
  return normalized === '' || PLACEHOLDER_SPACE_TITLE.test(normalized);
}

export function resolvedPayingSpaceTitle(
  title: string | null | undefined,
  web3SpaceId: number,
): string {
  const trimmed = title ? normalizePayingSpaceTitle(title) : '';
  return trimmed ? trimmed : `Space ${web3SpaceId}`;
}

export function isPlaceholderPayingSpace(input: {
  title?: string | null;
  web3SpaceId: number;
}): boolean {
  return isPlaceholderSpaceTitle(
    resolvedPayingSpaceTitle(input.title, input.web3SpaceId),
  );
}
