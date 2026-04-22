import { Coherence as DbCoherence } from '@hypha-platform/storage-postgres';
import { COHERENCE_TYPES, CoherenceType } from '../../coherence-types';
import { COHERENCE_TAGS, CoherenceTag } from '../../coherence-tags';
import {
  COHERENCE_PRIORITIES,
  CoherencePriority,
} from '../../coherence-priorities';
import { Coherence } from '../../types';

export function normalizeCoherence({
  type,
  priority,
  tags,
  attachments,
  roomId,
  archived,
  slug,
  messages,
  views,
  ...rest
}: DbCoherence): Coherence {
  return {
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
    attachments: Array.isArray(attachments)
      ? (attachments as Coherence['attachments'])
      : [],
    roomId: roomId ?? undefined,
    archived: archived ?? false,
    slug: slug ?? '',
    messages: messages ?? 0,
    views: views ?? 0,
    ...rest,
  };
}
