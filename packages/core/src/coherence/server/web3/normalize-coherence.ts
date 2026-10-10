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
import { IndicativePayout, SignalAttachment } from '../../types';

function normalizeMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSignalAttachments(value: unknown): SignalAttachment[] {
  if (!Array.isArray(value)) return [];
  const rows: SignalAttachment[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const name = String((row as { name?: unknown }).name ?? '').trim();
    const url = String((row as { url?: unknown }).url ?? '').trim();
    if (!name || !url) continue;
    rows.push({ name, url });
  }
  return rows;
}

function normalizeIndicativePayouts(value: unknown): IndicativePayout[] {
  if (!Array.isArray(value)) return [];
  const rows: IndicativePayout[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const amount = String((row as { amount?: unknown }).amount ?? '').trim();
    const token = String((row as { token?: unknown }).token ?? '').trim();
    if (!amount || !token) continue;
    rows.push({ amount, token });
  }
  return rows;
}

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
  indicativePayouts,
  leadImage,
  videoUrl,
  attachments,
  sharedWithNetwork,
  source,
  externalId,
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
    indicativePayouts: normalizeIndicativePayouts(indicativePayouts),
    leadImage: normalizeMediaUrl(leadImage),
    videoUrl: normalizeMediaUrl(videoUrl),
    attachments: normalizeSignalAttachments(attachments),
    sharedWithNetwork: sharedWithNetwork === true,
    source: source?.trim() || null,
    externalId: externalId?.trim() || null,
    ...rest,
  };
}
