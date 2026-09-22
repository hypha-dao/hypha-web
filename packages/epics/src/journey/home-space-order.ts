import { activityTimestamp } from './home-activity';

export type HomeSpaceOrderFields = {
  slug?: string | null;
  title?: string;
  memberCount?: number;
  memberAddresses?: unknown[] | null;
  updatedAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
};

/**
 * Most-used first. Visit history from `recent-space-history` wins, then
 * spaces that currently need attention, then last update, member count,
 * and name only as a last tie-break (never A–Z as the primary order).
 */
export function sortSpacesByMostUsed<T extends HomeSpaceOrderFields>(
  spaces: T[],
  {
    lastActiveSlug,
    recentSlugs = [],
    activitySlugs = [],
  }: {
    lastActiveSlug?: string | null;
    recentSlugs?: string[];
    activitySlugs?: string[];
  } = {},
): T[] {
  const lastActive = lastActiveSlug?.trim() ?? '';
  const recentIndex = new Map(
    recentSlugs
      .map((slug) => slug.trim())
      .filter(Boolean)
      .map((slug, index) => [slug, index]),
  );
  const withActivity = new Set(
    activitySlugs.map((slug) => slug.trim()).filter(Boolean),
  );

  return [...spaces].sort((left, right) => {
    const leftSlug = left.slug?.trim() ?? '';
    const rightSlug = right.slug?.trim() ?? '';

    const leftActive = leftSlug && leftSlug === lastActive ? 1 : 0;
    const rightActive = rightSlug && rightSlug === lastActive ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;

    const leftRecent = recentIndex.has(leftSlug)
      ? recentIndex.get(leftSlug)!
      : Number.POSITIVE_INFINITY;
    const rightRecent = recentIndex.has(rightSlug)
      ? recentIndex.get(rightSlug)!
      : Number.POSITIVE_INFINITY;
    if (leftRecent !== rightRecent) return leftRecent - rightRecent;

    const leftActivity = withActivity.has(leftSlug) ? 1 : 0;
    const rightActivity = withActivity.has(rightSlug) ? 1 : 0;
    if (leftActivity !== rightActivity) return rightActivity - leftActivity;

    const leftUpdated = activityTimestamp(left.updatedAt ?? left.createdAt);
    const rightUpdated = activityTimestamp(right.updatedAt ?? right.createdAt);
    if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated;

    const leftMembers = left.memberAddresses?.length ?? left.memberCount ?? 0;
    const rightMembers =
      right.memberAddresses?.length ?? right.memberCount ?? 0;
    if (leftMembers !== rightMembers) return rightMembers - leftMembers;

    return (left.title ?? '').localeCompare(right.title ?? '');
  });
}
