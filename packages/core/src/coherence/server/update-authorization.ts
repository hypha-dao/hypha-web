import type { Person } from '../../people/types';
import type { Coherence as DbCoherence } from '@hypha-platform/storage-postgres';
import type { UpdateCoherenceInput } from '../types';
import { personMayInteractWithCoherenceSpace } from './coherence-space-access';
import type { DbConfig } from '../../server';

const CONTENT_KEYS: (keyof UpdateCoherenceInput)[] = [
  'title',
  'description',
  'type',
  'priority',
  'tags',
];

export function patchHasContentFields(patch: UpdateCoherenceInput): boolean {
  return CONTENT_KEYS.some((k) => patch[k] !== undefined);
}

export async function assertCoherenceUpdateAllowed(
  person: Person,
  coherence: Pick<DbCoherence, 'creatorId' | 'spaceId'>,
  patch: UpdateCoherenceInput,
  config: DbConfig,
): Promise<void> {
  if (!coherence.spaceId) {
    throw new Error('Coherence has no space');
  }

  if (patchHasContentFields(patch)) {
    if (coherence.creatorId !== person.id) {
      throw new Error('Only the creator can edit this signal');
    }
    return;
  }

  const allowed = await personMayInteractWithCoherenceSpace(
    person,
    coherence.spaceId,
    config,
  );
  if (!allowed) {
    throw new Error('You do not have permission to update this signal');
  }
}

export async function assertCoherenceDeleteAllowed(
  person: Person,
  coherence: Pick<DbCoherence, 'creatorId' | 'spaceId'>,
  config: DbConfig,
): Promise<void> {
  if (coherence.creatorId !== person.id) {
    throw new Error('Only the creator can delete this signal');
  }
  if (!coherence.spaceId) {
    return;
  }
  const allowed = await personMayInteractWithCoherenceSpace(
    person,
    coherence.spaceId,
    config,
  );
  if (!allowed) {
    throw new Error('You do not have permission to delete this signal');
  }
}
