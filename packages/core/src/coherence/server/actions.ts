'use server';

import { getDb } from '../../common/server/get-db';
import { findSelf } from '../../people/server/queries';
import {
  CreateCoherenceInput,
  PatchCoherenceTaskBySlugInput,
  UpdateCoherenceBySlugInput,
  UpdateCoherenceSignalBySlugInput,
} from '../types';
import { db } from '@hypha-platform/storage-postgres';
import { and, eq } from 'drizzle-orm';
import { memberships } from '@hypha-platform/storage-postgres';
import {
  createCoherence,
  deleteCoherenceBySlug,
  patchCoherenceTaskBySlug,
  updateCoherenceBySlug,
  updateCoherenceSignalBySlug,
} from './mutations';
import {
  schemaPatchCoherenceTaskBySlug,
  schemaSignalWorkflowConfig,
  schemaUpdateCoherenceSignalBySlug,
} from '../validation';
import { z } from 'zod';
import {
  readSignalWorkflowConfig,
  updateSignalWorkflowConfig,
} from './signal-workflow';
import type { SignalWorkflowConfig } from '../signal-workflow';
import { assertCoherenceSpacePanelAuth } from './assert-coherence-space-panel-auth';
import { normalizeCoherence } from './web3/normalize-coherence';
import { findCoherenceForUpvote } from './coherence-upvotes';
import {
  applyCoherenceUpvote,
  applyCoherenceUpvoteRemoval,
} from './apply-coherence-upvote';
import type { CoherenceUpvoteSummary } from '../types';

async function assertSignalWorkflowAccess({
  spaceId,
  requesterPersonId,
}: {
  spaceId: number;
  requesterPersonId: number;
}) {
  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.spaceId, spaceId),
        eq(memberships.personId, requesterPersonId),
      ),
    )
    .limit(1);
  if (!membership) {
    throw new Error('Forbidden: user is not a member of this space');
  }
}

export async function createCoherenceAction(
  data: CreateCoherenceInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to create coherence');
  return createCoherence({ ...data }, { db });
}

export async function updateCoherenceBySlugAction(
  data: UpdateCoherenceBySlugInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to update coherence');
  }
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error(
      'Could not resolve authenticated user for update coherence',
    );
  }
  await assertCoherenceSpacePanelAuth({
    slug: data.slug,
    authToken,
    requesterPersonId: self.id,
  });
  return updateCoherenceBySlug(data, { db });
}

export async function deleteCoherenceBySlugAction(
  data: { slug: string },
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to delete coherence');
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error(
      'Could not resolve authenticated user for delete coherence',
    );
  }
  await assertCoherenceSpacePanelAuth({
    slug: data.slug,
    authToken,
    requesterPersonId: self.id,
  });
  return deleteCoherenceBySlug(
    { slug: data.slug, requesterPersonId: self.id },
    { db },
  );
}

export async function updateCoherenceSignalBySlugAction(
  data: UpdateCoherenceSignalBySlugInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to update coherence');

  let validated: z.infer<typeof schemaUpdateCoherenceSignalBySlug>;
  try {
    validated = schemaUpdateCoherenceSignalBySlug.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(
        details ? `Invalid signal update: ${details}` : 'Invalid signal update',
      );
    }
    throw error;
  }

  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error(
      'Could not resolve authenticated user for update coherence signal',
    );
  }
  await assertCoherenceSpacePanelAuth({
    slug: validated.slug,
    authToken,
    requesterPersonId: self.id,
  });
  const updated = await updateCoherenceSignalBySlug(
    { ...validated, requesterPersonId: self.id },
    { db },
  );
  return normalizeCoherence(updated);
}

export async function patchCoherenceTaskBySlugAction(
  data: PatchCoherenceTaskBySlugInput,
  { authToken }: { authToken?: string },
) {
  const validated = schemaPatchCoherenceTaskBySlug.parse(data);
  if (!authToken)
    throw new Error('authToken is required to patch coherence task');
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error(
      'Could not resolve authenticated user for patch coherence task',
    );
  }
  await assertCoherenceSpacePanelAuth({
    slug: validated.slug,
    authToken,
    requesterPersonId: self.id,
  });
  return patchCoherenceTaskBySlug(
    { ...validated, requesterPersonId: self.id },
    { db },
  );
}

async function resolveCoherenceUpvoteContext({
  slug,
  authToken,
}: {
  slug: string;
  authToken?: string;
}) {
  if (!authToken) {
    throw new Error('authToken is required to vote on a signal');
  }
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error('Could not resolve authenticated user for signal upvote');
  }
  const coherence = await findCoherenceForUpvote({ slug }, { db });
  if (!coherence) {
    throw new Error(`Signal not found for slug="${slug}"`);
  }
  return { self, coherence };
}

/**
 * Upvote a signal with a share of the caller's proposal voting power.
 * Voting power is read from the space's on-chain voting power source and
 * snapshotted; `votingPowerPercent` (1..100, default 100 = max) scales it.
 */
export async function upvoteCoherenceAction(
  {
    slug,
    votingPowerPercent = 100,
  }: { slug: string; votingPowerPercent?: number },
  { authToken }: { authToken?: string },
): Promise<CoherenceUpvoteSummary> {
  const { self, coherence } = await resolveCoherenceUpvoteContext({
    slug,
    authToken,
  });
  // Same membership rules as other signal interactions: Postgres membership
  // with an on-chain member/delegate fallback.
  await assertCoherenceSpacePanelAuth({
    slug,
    authToken: authToken as string,
    requesterPersonId: self.id,
  });

  return applyCoherenceUpvote(
    { coherence, actor: self, votingPowerPercent },
    { db },
  );
}

/** Remove the caller's own upvote from a signal. */
export async function removeCoherenceUpvoteAction(
  { slug }: { slug: string },
  { authToken }: { authToken?: string },
): Promise<CoherenceUpvoteSummary> {
  const { self, coherence } = await resolveCoherenceUpvoteContext({
    slug,
    authToken,
  });
  // Same membership rules as the upvote path — otherwise any authenticated
  // user could read arbitrary signals' upvote summaries via this action.
  await assertCoherenceSpacePanelAuth({
    slug,
    authToken: authToken as string,
    requesterPersonId: self.id,
  });

  return applyCoherenceUpvoteRemoval({ coherence, actor: self }, { db });
}

export async function getSignalWorkflowConfigAction(
  { spaceId }: { spaceId: number },
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to get signal workflow config');
  }
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error(
      'Could not resolve authenticated user for get signal workflow config',
    );
  }
  await assertSignalWorkflowAccess({ spaceId, requesterPersonId: self.id });
  return readSignalWorkflowConfig({ spaceId }, { db });
}

export async function updateSignalWorkflowConfigAction(
  { spaceId, config }: { spaceId: number; config: SignalWorkflowConfig },
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to update signal workflow config');
  }
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error(
      'Could not resolve authenticated user for update signal workflow config',
    );
  }
  await assertSignalWorkflowAccess({ spaceId, requesterPersonId: self.id });
  const validated = schemaSignalWorkflowConfig.parse(config);
  return updateSignalWorkflowConfig({ spaceId, config: validated }, { db });
}
