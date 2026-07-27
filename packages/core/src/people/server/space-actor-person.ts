import { people } from '@hypha-platform/storage-postgres';
import type { Person as DbPerson } from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';

import type { DbConfig } from '../../server';

/**
 * `people.sub` marker for the pseudo-person that represents a space itself.
 *
 * A space needs a row in `people` to own a signal, because `coherences
 * .creator_id` is a non-null foreign key. Privy subjects look like
 * `did:privy:…`, so this prefix can never collide with a real user, and a
 * space actor can never be authenticated as.
 */
export const SPACE_ACTOR_SUB_PREFIX = 'space:';

export function spaceActorSub(spaceId: number): string {
  return `${SPACE_ACTOR_SUB_PREFIX}${spaceId}`;
}

/** Space descriptor needed to present the space as an author on the board. */
export type SpaceActorSource = {
  id: number;
  slug: string;
  title: string;
  logoUrl?: string | null;
};

export const findSpaceActorPerson = async (
  { spaceId }: { spaceId: number },
  { db }: DbConfig,
): Promise<DbPerson | null> => {
  const [row] = await db
    .select()
    .from(people)
    .where(eq(people.sub, spaceActorSub(spaceId)))
    .limit(1);
  return row ?? null;
};

/**
 * Get — creating on first use — the person row that represents a space.
 *
 * Used when an integration reports an author Hypha does not know, so the
 * signal is attributed to the space rather than being rejected or pinned on an
 * unrelated member. The row carries no wallet address and no email, so it
 * holds no voting power and cannot be notified or signed in as.
 */
export const ensureSpaceActorPerson = async (
  { space }: { space: SpaceActorSource },
  { db }: DbConfig,
): Promise<DbPerson> => {
  const existing = await findSpaceActorPerson({ spaceId: space.id }, { db });
  if (existing) {
    return syncSpaceActorPerson({ actor: existing, space }, { db });
  }

  const baseSlug = `space-${space.slug}`;
  // `people.slug` is unique and a real member could already hold the plain
  // form, so fall back to a space-id-qualified slug. `onConflictDoNothing`
  // also absorbs a concurrent request creating the same actor.
  for (const slug of [baseSlug, `${baseSlug}-${space.id}`]) {
    const [created] = await db
      .insert(people)
      .values({
        sub: spaceActorSub(space.id),
        slug,
        name: space.title,
        nickname: space.title,
        avatarUrl: space.logoUrl ?? null,
      })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const raced = await findSpaceActorPerson({ spaceId: space.id }, { db });
    if (raced) return raced;
  }

  throw new Error(
    `Failed to create the space actor person for spaceId=${space.id}`,
  );
};

/** Keep the board label truthful after a space is renamed or re-branded. */
async function syncSpaceActorPerson(
  { actor, space }: { actor: DbPerson; space: SpaceActorSource },
  { db }: DbConfig,
): Promise<DbPerson> {
  const nextAvatarUrl = space.logoUrl ?? null;
  if (actor.name === space.title && actor.avatarUrl === nextAvatarUrl) {
    return actor;
  }

  const [updated] = await db
    .update(people)
    .set({
      name: space.title,
      nickname: space.title,
      avatarUrl: nextAvatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(people.id, actor.id))
    .returning();

  return updated ?? actor;
}
