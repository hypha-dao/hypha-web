import { EventType, MsgType } from 'matrix-js-sdk';

export const SIGNAL_TEAM_EVENT_BODY_MARKER = '[hypha:signal-team]';
export const SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER =
  '[hypha:signal-team-request]';

export type PublishSignalTeamNoticeInput = {
  client: {
    sendEvent: (
      roomId: string,
      eventType: string,
      content: Record<string, unknown>,
    ) => Promise<unknown>;
  };
  roomId: string;
  coherenceSlug: string;
  /** Selected team member MXIDs (owner/actor are merged in automatically). */
  memberMatrixUserIds: string[];
  ownerMatrixUserId?: string | null;
  actorMatrixUserId?: string | null;
  addedMemberMatrixUserIds?: string[];
  removedMemberMatrixUserIds?: string[];
};

/** Publish a signal-team notice event (same wire format as chat panel team management). */
export async function publishSignalTeamNotice({
  client,
  roomId,
  coherenceSlug,
  memberMatrixUserIds,
  ownerMatrixUserId,
  actorMatrixUserId,
  addedMemberMatrixUserIds,
  removedMemberMatrixUserIds,
}: PublishSignalTeamNoticeInput): Promise<void> {
  const ownerId = ownerMatrixUserId?.trim() || null;
  const actorId = actorMatrixUserId?.trim() || null;
  const deduped = normalizeMatrixUserIds([
    ...memberMatrixUserIds,
    ...(ownerId ? [ownerId] : []),
    ...(actorId ? [actorId] : []),
  ]);
  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: MsgType.Notice,
    body: SIGNAL_TEAM_EVENT_BODY_MARKER,
    coherenceSlug: coherenceSlug.trim() || null,
    memberMatrixUserIds: deduped,
    ownerMatrixUserId: ownerId,
    addedMemberMatrixUserIds: normalizeMatrixUserIds(
      addedMemberMatrixUserIds ?? memberMatrixUserIds,
    ),
    removedMemberMatrixUserIds: normalizeMatrixUserIds(
      removedMemberMatrixUserIds,
    ),
    updatedAt: new Date().toISOString(),
  });
}

export type SignalTeamNoticeKind =
  | 'updated'
  | 'access_requested'
  | 'access_approved'
  | 'members_updated';

export type SignalTeamNotice = {
  kind: SignalTeamNoticeKind;
  addedMemberMatrixUserIds: string[];
  removedMemberMatrixUserIds: string[];
};

function normalizeMatrixUserIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

function formatMatrixUserIdForPlainText(userId: string): string {
  const trimmed = userId.trim();
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

/** User-facing notice text with full MXIDs so mention pills can resolve Hypha names. */
export function formatSignalTeamUpdateDisplayBody(
  addedMemberMatrixUserIds: string[],
  removedMemberMatrixUserIds: string[],
): string {
  const added = normalizeMatrixUserIds(addedMemberMatrixUserIds).map(
    formatMatrixUserIdForPlainText,
  );
  const removed = normalizeMatrixUserIds(removedMemberMatrixUserIds).map(
    formatMatrixUserIdForPlainText,
  );
  const summaryParts: string[] = [];
  if (added.length > 0) {
    summaryParts.push(`added ${added.join(', ')}`);
  }
  if (removed.length > 0) {
    summaryParts.push(`removed ${removed.join(', ')}`);
  }
  const summaryText =
    summaryParts.length > 0 ? `: ${summaryParts.join('; ')}` : '';
  return `signal team updated${summaryText}`;
}

export function parseSignalTeamMemberChangesFromWireContent(
  content: Record<string, unknown>,
  body: string,
): { added: string[]; removed: string[] } | null {
  if (!body.includes(SIGNAL_TEAM_EVENT_BODY_MARKER)) return null;
  const added = normalizeMatrixUserIds(content.addedMemberMatrixUserIds);
  const removed = normalizeMatrixUserIds(content.removedMemberMatrixUserIds);
  if (added.length === 0 && removed.length === 0) return null;
  return { added, removed };
}

export function parseSignalTeamNoticeFromWireContent(
  content: Record<string, unknown>,
  body: string,
): SignalTeamNotice | null {
  const trimmedBody = body.trim();

  if (trimmedBody.includes(SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER)) {
    const status =
      typeof content.status === 'string' ? content.status.trim() : '';
    if (status === 'approved' || trimmedBody.includes('access approved')) {
      return {
        kind: 'access_approved',
        addedMemberMatrixUserIds: [],
        removedMemberMatrixUserIds: [],
      };
    }
    return {
      kind: 'access_requested',
      addedMemberMatrixUserIds: [],
      removedMemberMatrixUserIds: [],
    };
  }

  if (!trimmedBody.includes(SIGNAL_TEAM_EVENT_BODY_MARKER)) return null;

  const added = normalizeMatrixUserIds(content.addedMemberMatrixUserIds);
  const removed = normalizeMatrixUserIds(content.removedMemberMatrixUserIds);
  if (added.length > 0 || removed.length > 0) {
    return {
      kind: 'updated',
      addedMemberMatrixUserIds: added,
      removedMemberMatrixUserIds: removed,
    };
  }

  const withoutMarker = trimmedBody
    .replace(SIGNAL_TEAM_EVENT_BODY_MARKER, '')
    .trim();

  if (withoutMarker === 'signal team members updated') {
    return {
      kind: 'members_updated',
      addedMemberMatrixUserIds: [],
      removedMemberMatrixUserIds: [],
    };
  }

  if (
    withoutMarker.length > 0 &&
    (withoutMarker.startsWith('signal team updated') ||
      withoutMarker.includes('access requested') ||
      withoutMarker.includes('access approved'))
  ) {
    return null;
  }

  if (Array.isArray(content.memberMatrixUserIds)) {
    return {
      kind: 'members_updated',
      addedMemberMatrixUserIds: [],
      removedMemberMatrixUserIds: [],
    };
  }

  return {
    kind: 'updated',
    addedMemberMatrixUserIds: [],
    removedMemberMatrixUserIds: [],
  };
}

export function resolveSignalTeamUpdateDisplayBody(
  content: Record<string, unknown>,
  body: string,
): string | null {
  const changes = parseSignalTeamMemberChangesFromWireContent(content, body);
  if (!changes) return null;
  return formatSignalTeamUpdateDisplayBody(changes.added, changes.removed);
}

/** Only meaningful team changes belong in chat; roster snapshots are call-only noise. */
export function shouldIncludeSignalTeamNoticeInChatTimeline(
  notice: SignalTeamNotice | null | undefined,
): boolean {
  if (!notice) return true;
  if (notice.kind === 'access_requested' || notice.kind === 'access_approved') {
    return true;
  }
  return (
    notice.addedMemberMatrixUserIds.length > 0 ||
    notice.removedMemberMatrixUserIds.length > 0
  );
}
