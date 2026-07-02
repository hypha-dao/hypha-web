import 'server-only';

import { db } from '@hypha-platform/storage-postgres';
import { findSpaceBySlug } from '../../space/server/queries';
import { findCoherenceBySlug } from './queries';

type ResolveCoherenceTaskPatchContextInput = {
  spaceSlug: string;
  slug: string;
};

type ResolveCoherenceTaskPatchContextResult =
  | {
      ok: true;
      space: NonNullable<Awaited<ReturnType<typeof findSpaceBySlug>>>;
      coherence: NonNullable<Awaited<ReturnType<typeof findCoherenceBySlug>>>;
    }
  | { ok: false; status: 404; error: string };

export async function resolveCoherenceTaskPatchContext({
  spaceSlug,
  slug,
}: ResolveCoherenceTaskPatchContextInput): Promise<ResolveCoherenceTaskPatchContextResult> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return { ok: false, status: 404, error: 'Space not found' };
  }

  const coherence = await findCoherenceBySlug({ slug }, { db });
  if (!coherence || coherence.spaceId !== space.id) {
    return { ok: false, status: 404, error: 'Signal not found' };
  }

  return { ok: true, space, coherence };
}
