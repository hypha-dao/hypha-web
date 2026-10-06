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
import { coherences, memberships } from '@hypha-platform/storage-postgres';
import {
  acknowledgeCoherenceAssignment,
  createCoherence,
  deleteCoherenceBySlug,
  mergeCoherenceTags,
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
import { findPersonsBySlug } from '../../people/server/queries';
import { findSpaceBySlug } from '../../space/server/queries';
import { newlyMentionedSlugs } from '../signal-mentions';
import {
  dueAtHasChanged,
  newlyAssignedPersonIds,
} from '../signal-notification-triggers';
import {
  getSignalAssignedNotifier,
  getSignalLifecycleNotifier,
  type SignalAssignedNotifierInput,
  type SignalLifecycleKind,
  type SignalLifecycleNotifierInput,
} from './signal-assigned-notifier';

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

/**
 * Server-fired signal-assignment notification (#2470); best-effort, never fails the mutation.
 * Delegates to whatever `apps/web`'s `instrumentation.ts` registered via
 * `setSignalAssignedNotifier` (see `./signal-assigned-notifier.ts` for why this is a registration
 * slot rather than a direct import of `@hypha-platform/notifications`).
 */
async function notifySignalLifecycle(input: SignalLifecycleNotifierInput) {
  if (input.recipientPersonIds.length === 0) return;
  const lifecycle = getSignalLifecycleNotifier();
  if (lifecycle) {
    try {
      await lifecycle(input);
    } catch (error) {
      console.error(`Failed to notify signal ${input.kind}:`, error);
    }
    return;
  }
  if (input.kind !== 'assigned') return;
  const assigned = getSignalAssignedNotifier();
  if (!assigned) return;
  try {
    await assigned({
      spaceId: input.spaceId,
      assigneePersonIds: input.recipientPersonIds,
      actorPersonId: input.actorPersonId,
      signalSlug: input.signalSlug,
      signalTitle: input.signalTitle,
      dueAt: input.dueAt,
    });
  } catch (error) {
    console.error('Failed to notify signal assignees:', error);
  }
}

async function notifySignalAssigned(input: SignalAssignedNotifierInput) {
  await notifySignalLifecycle({
    kind: 'assigned',
    spaceId: input.spaceId,
    recipientPersonIds: input.assigneePersonIds,
    actorPersonId: input.actorPersonId,
    signalSlug: input.signalSlug,
    signalTitle: input.signalTitle,
    dueAt: input.dueAt,
  });
}

async function notifySignalKind(
  kind: SignalLifecycleKind,
  input: Omit<SignalLifecycleNotifierInput, 'kind'>,
) {
  await notifySignalLifecycle({ kind, ...input });
}

async function notifyNewMentions({
  spaceId,
  actorPersonId,
  signalSlug,
  signalTitle,
  previousDescription,
  nextDescription,
}: {
  spaceId: number;
  actorPersonId: number | null;
  signalSlug: string;
  signalTitle: string;
  previousDescription?: string | null;
  nextDescription?: string | null;
}) {
  const slugs = newlyMentionedSlugs(previousDescription, nextDescription);
  if (slugs.length === 0) return;
  const people = await findPersonsBySlug({ slugs }, { db });
  const recipientPersonIds = people
    .map((person) => person.id)
    .filter((id) => id !== actorPersonId);
  await notifySignalKind('mentioned', {
    spaceId,
    recipientPersonIds,
    actorPersonId,
    signalSlug,
    signalTitle,
    mentionExcerpt: (nextDescription ?? '').slice(0, 280),
  });
}

export async function createCoherenceAction(
  data: CreateCoherenceInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to create coherence');
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error(
      'Could not resolve authenticated user for create coherence',
    );
  }
  const newSignal = await createCoherence({ ...data }, { db });
  if (newSignal.spaceId != null) {
    await notifySignalAssigned({
      spaceId: newSignal.spaceId,
      assigneePersonIds: newSignal.assigneeIds ?? [],
      actorPersonId: self.id,
      signalSlug: newSignal.slug ?? '',
      signalTitle: newSignal.title ?? '',
      dueAt: newSignal.dueAt,
    });
    await notifyNewMentions({
      spaceId: newSignal.spaceId,
      actorPersonId: self.id,
      signalSlug: newSignal.slug ?? '',
      signalTitle: newSignal.title ?? '',
      previousDescription: '',
      nextDescription: newSignal.description,
    });
  }
  return newSignal;
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

  const [previousRow] = await db
    .select({
      assigneeIds: coherences.assigneeIds,
      dueAt: coherences.dueAt,
      description: coherences.description,
    })
    .from(coherences)
    .where(eq(coherences.slug, validated.slug))
    .limit(1);
  const previousAssigneeIds = previousRow?.assigneeIds ?? [];

  const updated = await updateCoherenceSignalBySlug(
    { ...validated, requesterPersonId: self.id },
    { db },
  );

  if (updated.spaceId != null) {
    if (validated.assigneeIds !== undefined) {
      await notifySignalAssigned({
        spaceId: updated.spaceId,
        assigneePersonIds: newlyAssignedPersonIds(
          previousAssigneeIds,
          updated.assigneeIds,
        ),
        actorPersonId: self.id,
        signalSlug: updated.slug ?? '',
        signalTitle: updated.title ?? '',
        dueAt: updated.dueAt,
      });
    }
    if (dueAtHasChanged(previousRow?.dueAt, updated.dueAt)) {
      await notifySignalKind('deadline_changed', {
        spaceId: updated.spaceId,
        recipientPersonIds: (updated.assigneeIds ?? []).filter(
          (id) => id !== self.id,
        ),
        actorPersonId: self.id,
        signalSlug: updated.slug ?? '',
        signalTitle: updated.title ?? '',
        dueAt: updated.dueAt,
      });
    }
    await notifyNewMentions({
      spaceId: updated.spaceId,
      actorPersonId: self.id,
      signalSlug: updated.slug ?? '',
      signalTitle: updated.title ?? '',
      previousDescription: previousRow?.description,
      nextDescription: updated.description,
    });
  }

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
  const [previousRow] = await db
    .select({
      assigneeIds: coherences.assigneeIds,
      dueAt: coherences.dueAt,
    })
    .from(coherences)
    .where(eq(coherences.slug, validated.slug))
    .limit(1);
  const updated = await patchCoherenceTaskBySlug(
    { ...validated, requesterPersonId: self.id },
    { db },
  );
  if (updated.spaceId != null) {
    if (validated.assigneeIds !== undefined) {
      await notifySignalAssigned({
        spaceId: updated.spaceId,
        assigneePersonIds: newlyAssignedPersonIds(
          previousRow?.assigneeIds,
          updated.assigneeIds,
        ),
        actorPersonId: self.id,
        signalSlug: updated.slug ?? '',
        signalTitle: updated.title ?? '',
        dueAt: updated.dueAt,
      });
    }
    if (
      validated.dueAt !== undefined &&
      dueAtHasChanged(previousRow?.dueAt, updated.dueAt)
    ) {
      await notifySignalKind('deadline_changed', {
        spaceId: updated.spaceId,
        recipientPersonIds: (updated.assigneeIds ?? []).filter(
          (id) => id !== self.id,
        ),
        actorPersonId: self.id,
        signalSlug: updated.slug ?? '',
        signalTitle: updated.title ?? '',
        dueAt: updated.dueAt,
      });
    }
  }
  return updated;
}

export async function mergeCoherenceTagsAction(
  {
    spaceSlug,
    fromTag,
    toTag,
  }: { spaceSlug: string; fromTag: string; toTag: string },
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to merge tags');
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error('Could not resolve authenticated user for merge tags');
  }
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    throw new Error('Space not found');
  }
  await assertSignalWorkflowAccess({
    spaceId: space.id,
    requesterPersonId: self.id,
  });
  return mergeCoherenceTags({ spaceId: space.id, fromTag, toTag }, { db });
}

export async function acknowledgeCoherenceAssignmentAction(
  { slug }: { slug: string },
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to acknowledge a signal');
  }
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error(
      'Could not resolve authenticated user for acknowledge signal',
    );
  }
  await assertCoherenceSpacePanelAuth({
    slug,
    authToken,
    requesterPersonId: self.id,
  });
  const updated = await acknowledgeCoherenceAssignment(
    { slug, personId: self.id },
    { db },
  );
  return updated ? normalizeCoherence(updated) : null;
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
