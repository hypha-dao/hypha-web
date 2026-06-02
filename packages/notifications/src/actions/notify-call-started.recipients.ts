import { eq, inArray } from 'drizzle-orm';
import {
  db,
  matrixUserLinks,
  memberships,
  people,
  spaces,
} from '@hypha-platform/storage-postgres';

export async function resolveSpaceMemberSlugs(
  spaceSlug: string,
  excludeSlug?: string,
): Promise<string[]> {
  const trimmedSlug = spaceSlug.trim();
  if (!trimmedSlug) return [];

  const rows = await db
    .select({ slug: people.slug })
    .from(people)
    .innerJoin(memberships, eq(memberships.personId, people.id))
    .innerJoin(spaces, eq(memberships.spaceId, spaces.id))
    .where(eq(spaces.slug, trimmedSlug));

  return [
    ...new Set(
      rows
        .map((row) => row.slug?.trim())
        .filter((slug): slug is string =>
          Boolean(slug && (!excludeSlug || slug !== excludeSlug)),
        ),
    ),
  ];
}

export async function resolveSlugsFromMatrixUserIds(
  matrixUserIds: string[],
  excludeSlug?: string,
): Promise<string[]> {
  const ids = [
    ...new Set(matrixUserIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (ids.length === 0) return [];

  const rows = await db
    .select({ slug: people.slug })
    .from(matrixUserLinks)
    .innerJoin(people, eq(matrixUserLinks.privyUserId, people.sub))
    .where(inArray(matrixUserLinks.matrixUserId, ids));

  return [
    ...new Set(
      rows
        .map((row) => row.slug?.trim())
        .filter((slug): slug is string =>
          Boolean(slug && (!excludeSlug || slug !== excludeSlug)),
        ),
    ),
  ];
}

export async function resolveCallStartedRecipientSlugs(input: {
  scope: 'space_members' | 'signal_team';
  spaceSlug: string;
  actorSlug?: string;
  targetMatrixUserIds?: string[];
}): Promise<string[]> {
  if (input.scope === 'signal_team') {
    const teamSlugs = await resolveSlugsFromMatrixUserIds(
      input.targetMatrixUserIds ?? [],
      input.actorSlug,
    );
    if (teamSlugs.length > 0) return teamSlugs;
  }

  return resolveSpaceMemberSlugs(input.spaceSlug, input.actorSlug);
}
