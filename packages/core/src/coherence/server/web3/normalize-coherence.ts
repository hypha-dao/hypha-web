import { Coherence as DbCoherence } from '@hypha-platform/storage-postgres';
import { COHERENCE_TYPES, CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';
import {
  COHERENCE_PRIORITIES,
  CoherencePriority,
} from '../../coherence-priorities';
import { Coherence } from '../../types';
import {
  DEFAULT_SIGNAL_PROGRESS_STATUS,
  normalizeAssigneeIds,
} from '../../signal-workflow';

export function normalizeCoherence({
  type,
  priority,
  tags,
  roomId,
  archived,
  slug,
  messages,
  views,
  dueAt,
  progressStatus,
  board,
  assigneeIds,
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
      ? (tags
          .filter((tag): tag is string => typeof tag === 'string')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0) as CoherenceTag[])
      : [],
    roomId: roomId ?? undefined,
    archived: archived ?? false,
    slug: slug ?? '',
    messages: messages ?? 0,
    views: views ?? 0,
    dueAt: dueAt ?? null,
    progressStatus: progressStatus?.trim() || DEFAULT_SIGNAL_PROGRESS_STATUS,
    board: board?.trim() || null,
    assigneeIds: normalizeAssigneeIds(assigneeIds),
    ...rest,
  };
}
