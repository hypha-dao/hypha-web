/**
 * Test / unmapped placeholders such as "Space 224" (default title for a
 * web3 space id with no real org name). Excluded from paying-spaces KPIs,
 * monthly aggregation, and the space filter list.
 */
const PLACEHOLDER_SPACE_TITLE = /^space\s+\d+$/i;

export function isPlaceholderSpaceTitle(title: string): boolean {
  return PLACEHOLDER_SPACE_TITLE.test(title.trim());
}

export function resolvedPayingSpaceTitle(
  title: string | null | undefined,
  web3SpaceId: number,
): string {
  const trimmed = title?.trim();
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
