'use server';

import { db } from '@hypha-platform/storage-postgres';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';
import { findAllCoherences } from '../queries';
import { Coherence } from '../../types';

type GetAllCoherencesInput = {
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
};

export async function getAllCoherences(
  props: GetAllCoherencesInput = {},
): Promise<Coherence[]> {
  try {
    const coherences = await findAllCoherences({ db }, props);

    return coherences.map(
      ({ status, roomId, archived, ...rest }): Coherence => ({
        status: status ?? 'signal',
        roomId: roomId ?? undefined,
        archived: archived ?? false,
        ...rest,
      }),
    );
  } catch (error) {
    throw new Error('Failed to get coherences', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
