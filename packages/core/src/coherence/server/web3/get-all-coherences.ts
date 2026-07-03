'use server';

import { db } from '@hypha-platform/storage-postgres';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';
import { CoherencePriority } from '../../coherence-priorities';
import { findAllCoherences } from '../queries';
import { Coherence } from '../../types';
import { normalizeCoherence } from './normalize-coherence';

type GetAllCoherencesInput = {
  spaceId?: number;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  priority?: CoherencePriority;
  includeArchived?: boolean;
  orderBy?: 'mostrecent' | 'mostmessages' | 'mostviews' | 'mostupvoted';
  progressStatus?: string;
  board?: string;
  assigneeId?: number;
  overdue?: boolean;
};

export async function getAllCoherences(
  props: GetAllCoherencesInput = {},
): Promise<Coherence[]> {
  try {
    const coherences = await findAllCoherences({ db }, props);
    return coherences.map(normalizeCoherence);
  } catch (error) {
    throw new Error('Failed to get coherences', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
