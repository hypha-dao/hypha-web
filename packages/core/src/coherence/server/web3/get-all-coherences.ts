'use server';

import { db } from '@hypha-platform/storage-postgres';
import { CoherenceType, COHERENCE_TYPES } from '../../coherence-types';
import { CoherenceTag, COHERENCE_TAGS } from '../../coherence-tags';
import {
  CoherencePriority,
  COHERENCE_PRIORITIES,
} from '../../coherence-priorities';
import { findAllCoherences } from '../queries';
import { Coherence } from '../../types';

type GetAllCoherencesInput = {
  spaceId?: number;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  priority?: CoherencePriority;
  includeArchived?: boolean;
  orderBy?: 'mostrecent' | 'mostmessages' | 'mostviews';
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
        type: (COHERENCE_TYPES as readonly string[]).includes(type)
          ? (type as CoherenceType)
          : 'Opportunity',
        priority:
          priority !== null &&
          (COHERENCE_PRIORITIES as readonly string[]).includes(priority)
            ? (priority as CoherencePriority)
            : 'medium',
        tags: Array.isArray(tags)
          ? (tags.filter((t) =>
              (COHERENCE_TAGS as readonly string[]).includes(t),
            ) as CoherenceTag[])
          : [],
        roomId: roomId ?? undefined,
        archived: archived ?? false,
        slug: slug ?? '',
        messages: messages ?? 0,
        views: views ?? 0,
        ...rest,
      }),
    );
  } catch (error) {
    throw new Error('Failed to get coherences', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
