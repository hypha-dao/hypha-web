'use server';

import { db } from '@hypha-platform/storage-postgres';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';
import { CoherencePriority } from '../../coherence-priorities';
import { findAllCoherences } from '../queries';
import { Coherence } from '../../types';

type GetAllCoherencesInput = {
  spaceId?: number;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  priority?: CoherencePriority;
  includeArchived?: boolean;
  orderBy?: string;
};

export async function getAllCoherences(
  props: GetAllCoherencesInput = {},
): Promise<Coherence[]> {
  try {
    const coherences = await findAllCoherences({ db }, props);

    return coherences.map(
      ({
        priority,
        type,
        roomId,
        archived,
        slug,
        tags,
        messages,
        views,
        ...rest
      }): Coherence => ({
        type: type as CoherenceType,
        priority: (priority as CoherencePriority) ?? 'low',
        tags: tags as CoherenceTag[],
        roomId: roomId ?? undefined,
        archived: archived ?? false,
        slug: slug!,
        messages: messages!,
        views: views!,
        ...rest,
      }),
    );
  } catch (error) {
    throw new Error('Failed to get coherences', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
