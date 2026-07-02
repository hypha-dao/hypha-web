import 'server-only';

import { db } from '@hypha-platform/storage-postgres';
import { authorizeSpacePanelInteraction } from '../../space/server/authorize-space-panel-interaction';
import { findSpaceById } from '../../space/server/queries';
import { findCoherenceBySlug } from './queries';

/** Space panel auth (members/delegates) plus signal creators. */
export async function assertCoherenceSpacePanelAuth({
  slug,
  authToken,
  requesterPersonId,
}: {
  slug: string;
  authToken: string;
  requesterPersonId?: number;
}): Promise<void> {
  const coherence = await findCoherenceBySlug({ slug }, { db });
  if (!coherence) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }
  if (coherence.spaceId == null) {
    throw new Error(`Coherence has no space for slug="${slug}"`);
  }

  if (requesterPersonId != null && coherence.creatorId === requesterPersonId) {
    return;
  }

  const space = await findSpaceById({ id: coherence.spaceId }, { db });
  if (!space?.slug) {
    throw new Error('Space not found for coherence');
  }

  const interactionAuth = await authorizeSpacePanelInteraction({
    spaceSlug: space.slug,
    authToken,
  });
  if (!interactionAuth.authorized) {
    throw new Error(interactionAuth.message);
  }
}
