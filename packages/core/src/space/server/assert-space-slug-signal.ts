import type { DatabaseInstance } from '../../common/server/types';
import { signalSlugMatchesSpaceSlug } from '../../coherence/signal-slug';
import { eq } from 'drizzle-orm';
import { coherences, spaces } from '@hypha-platform/storage-postgres';

function readUpdateSlug(patch: object): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(patch, 'slug')) return undefined;
  const slug = (patch as { slug?: unknown }).slug;
  return typeof slug === 'string' ? slug : undefined;
}

/** Reject a changed space slug that matches one of that space's signal slugs. */
export async function rejectSpaceSlugMatchingSignal(
  db: Pick<DatabaseInstance, 'select'>,
  {
    spaceId,
    currentSlug,
    nextSlug,
  }: {
    spaceId: number;
    currentSlug: string | null;
    nextSlug?: string | null;
  },
): Promise<void> {
  if (typeof nextSlug !== 'string' || nextSlug === currentSlug) return;

  const signalRows = await db
    .select({ slug: coherences.slug })
    .from(coherences)
    .where(eq(coherences.spaceId, spaceId));

  const matchesSignal = signalRows.some((row) =>
    signalSlugMatchesSpaceSlug(row.slug, nextSlug),
  );
  if (!matchesSignal) return;

  throw new Error(
    `Cannot set a space slug that matches one of its signal slugs "${nextSlug.trim()}"`,
  );
}

/**
 * `updateSpaceBySlug` selects the row by slug. A different slug on the write
 * is a rename and must not collide with one of that space's signals.
 */
export async function rejectReplacementSpaceSlug(
  db: Pick<DatabaseInstance, 'select'>,
  {
    lookupSlug,
    patch,
  }: {
    lookupSlug: string;
    patch: object;
  },
): Promise<void> {
  const nextSlug = readUpdateSlug(patch);
  if (typeof nextSlug !== 'string' || nextSlug === lookupSlug) return;

  const [currentSpace] = await db
    .select({ id: spaces.id, slug: spaces.slug })
    .from(spaces)
    .where(eq(spaces.slug, lookupSlug))
    .limit(1);
  if (!currentSpace) return;

  await rejectSpaceSlugMatchingSignal(db, {
    spaceId: currentSpace.id,
    currentSlug: currentSpace.slug,
    nextSlug,
  });
}
