import { and, eq, inArray } from 'drizzle-orm';
import { coherences, people } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '@hypha-platform/core/server';
import { normalizeAssigneeIds } from '../../coherence/signal-workflow';
import type { ScheduledItem } from '../types';
import { findSpaceMemberSlugsBySpaceId } from './queries';

async function findSlugsByPersonIds(
  { personIds }: { personIds: number[] },
  { db }: DbConfig,
): Promise<string[]> {
  if (personIds.length === 0) return [];
  const rows = await db
    .select({ slug: people.slug })
    .from(people)
    .where(inArray(people.id, personIds));

  return [
    ...new Set(
      rows
        .map((row) => row.slug?.trim())
        .filter((slug): slug is string => Boolean(slug)),
    ),
  ];
}

async function findSlugByPersonId(
  personId: number,
  { db }: DbConfig,
): Promise<string | null> {
  const [row] = await db
    .select({ slug: people.slug })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  return row?.slug?.trim() || null;
}

function excludeSlug(slugs: string[], excludeSlugValue?: string | null): string[] {
  if (!excludeSlugValue) return slugs;
  return slugs.filter((slug) => slug !== excludeSlugValue);
}

/** Signal assignees when linked; otherwise all space members. */
export async function resolveScheduledItemRecipientSlugs(
  item: ScheduledItem,
  { db }: DbConfig,
  options?: { excludeCreator?: boolean },
): Promise<string[]> {
  const excludeSlugValue =
    options?.excludeCreator && item.creatorId
      ? await findSlugByPersonId(item.creatorId, { db })
      : null;

  if (item.coherenceId) {
    const [coherence] = await db
      .select({ assigneeIds: coherences.assigneeIds })
      .from(coherences)
      .where(
        and(
          eq(coherences.id, item.coherenceId),
          eq(coherences.spaceId, item.spaceId),
        ),
      )
      .limit(1);

    const assigneeIds = normalizeAssigneeIds(coherence?.assigneeIds);
    if (assigneeIds.length > 0) {
      const slugs = await findSlugsByPersonIds({ personIds: assigneeIds }, { db });
      const filtered = excludeSlug(slugs, excludeSlugValue);
      if (filtered.length > 0) return filtered;
    }
  }

  const memberSlugs = await findSpaceMemberSlugsBySpaceId(
    { spaceId: item.spaceId },
    { db },
  );
  return excludeSlug(memberSlugs, excludeSlugValue);
}
