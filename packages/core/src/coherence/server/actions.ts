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
import {
  readSignalWorkflowConfig,
  updateSignalWorkflowConfig,
} from './signal-workflow';
import type { SignalWorkflowConfig } from '../signal-workflow';

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
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
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
  return deleteCoherenceBySlug(
    { slug: data.slug, requesterPersonId: self.id },
    { db },
  );
}

export async function updateCoherenceSignalBySlugAction(
  data: UpdateCoherenceSignalBySlugInput,
  { authToken }: { authToken?: string },
) {
  const validated = schemaUpdateCoherenceSignalBySlug.parse(data);
  if (!authToken) throw new Error('authToken is required to update coherence');
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error(
      'Could not resolve authenticated user for update coherence signal',
    );
  }
  return updateCoherenceSignalBySlug(
    { ...validated, requesterPersonId: self.id },
    { db },
  );
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
