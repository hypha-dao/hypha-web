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
import {
  EMPTY_COHERENCE_UPVOTE_SUMMARY,
  findCoherenceForUpvote,
  findCoherenceUpvoteSummaries,
  removeCoherenceUpvote,
  upsertCoherenceUpvote,
} from './coherence-upvotes';
import { getMemberVotingPower } from './web3/get-member-voting-power';
import { recordSignalUpvoteOnChain } from './web3/record-signal-upvote-onchain';
import { after } from 'next/server';
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

async function getCoherenceUpvoteSummary({
  coherenceId,
  viewerPersonId,
}: {
  coherenceId: number;
  viewerPersonId: number;
}): Promise<CoherenceUpvoteSummary> {
  const summaries = await findCoherenceUpvoteSummaries(
    { coherenceIds: [coherenceId], viewerPersonId },
    { db },
  );
  return summaries[coherenceId] ?? EMPTY_COHERENCE_UPVOTE_SUMMARY;
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
  if (coherence.archived) {
    throw new Error('Cannot vote on an archived signal');
  }
  if (coherence.spaceId == null || coherence.web3SpaceId == null) {
    throw new Error('Signal space is not linked to an on-chain space');
  }
  if (!self.address) {
    throw new Error('A linked wallet is required to vote on signals');
  }
  // Same membership rules as other signal interactions: Postgres membership
  // with an on-chain member/delegate fallback.
  await assertCoherenceSpacePanelAuth({
    slug,
    authToken: authToken as string,
    requesterPersonId: self.id,
  });

  const percent = Math.min(
    100,
    Math.max(1, Math.trunc(Number(votingPowerPercent) || 100)),
  );

  const { votingPower: maxVotingPower, tokenDecimals } =
    await getMemberVotingPower({
      memberAddress: self.address as `0x${string}`,
      web3SpaceId: coherence.web3SpaceId,
    });
  if (maxVotingPower <= 0n) {
    throw new Error('You have no voting power in this space');
  }

  let votingPower = (maxVotingPower * BigInt(percent)) / 100n;
  if (votingPower <= 0n) {
    votingPower = 1n;
  }

  await upsertCoherenceUpvote(
    {
      coherenceId: coherence.id,
      personId: self.id,
      votingPower: votingPower.toString(),
      maxVotingPower: maxVotingPower.toString(),
      tokenDecimals,
    },
    { db },
  );

  // Mirror the upvote to the Signals contract after the response is sent;
  // best-effort and invisible to the user.
  const web3SpaceId = coherence.web3SpaceId;
  const voter = self.address as `0x${string}`;
  const amount = votingPower;
  after(() =>
    recordSignalUpvoteOnChain({
      web3SpaceId,
      signalId: coherence.id,
      voter,
      amount,
      kind: 'upvote',
    }),
  );

  return getCoherenceUpvoteSummary({
    coherenceId: coherence.id,
    viewerPersonId: self.id,
  });
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
  await removeCoherenceUpvote(
    { coherenceId: coherence.id, personId: self.id },
    { db },
  );

  if (coherence.web3SpaceId != null && self.address) {
    const web3SpaceId = coherence.web3SpaceId;
    const voter = self.address as `0x${string}`;
    after(() =>
      recordSignalUpvoteOnChain({
        web3SpaceId,
        signalId: coherence.id,
        voter,
        kind: 'removal',
      }),
    );
  }

  return getCoherenceUpvoteSummary({
    coherenceId: coherence.id,
    viewerPersonId: self.id,
  });
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
