import type { LoadRoomHistoryResult } from '@hypha-platform/core/client';

const SIGNAL_TEAM_EVENT_BODY_MARKER = '[hypha:signal-team]';
const SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER = '[hypha:signal-team-request]';

export type SignalChatMatrixMessage = {
  id: string;
  timestamp: Date;
  content: string;
  msgtype?: 'm.text' | 'm.file' | 'm.image' | 'm.audio';
};

export type SignalChatMatrixOps = {
  joinRoom: (roomId: string) => Promise<string>;
  loadRoomHistory: (roomId: string) => Promise<LoadRoomHistoryResult>;
  getRoomMessages: (roomId: string) => SignalChatMatrixMessage[] | null;
  editRoomMessage: (params: {
    roomId: string;
    targetEventId: string;
    message: string;
  }) => Promise<void>;
};

export function normalizeSignalDescriptionForChat(
  description?: string | null,
): string | null {
  if (!description) return null;
  const raw = description.trim();
  if (!raw) return null;

  // Rich text serialization may persist trailing spaces as HTML entities
  // (e.g. "&#x20;"), which Matrix then renders as literal text.
  const decodeRichTextSpaceEntities = (value: string): string => {
    const fromCodePoint = (code: number, fallback: string): string => {
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
        return fallback;
      }
      return String.fromCodePoint(code);
    };

    return value
      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) =>
        fromCodePoint(Number.parseInt(hex, 16), match),
      )
      .replace(/&#(\d+);/g, (match, dec) =>
        fromCodePoint(Number.parseInt(dec, 10), match),
      )
      .replace(/&nbsp;/gi, '\u00A0');
  };

  const decoded = decodeRichTextSpaceEntities(raw)
    .replace(/\u00A0/g, ' ')
    .trim();
  return decoded.length > 0 ? decoded : null;
}

function isSignalTeamTimelineMessage(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.startsWith(SIGNAL_TEAM_EVENT_BODY_MARKER) ||
    trimmed.startsWith(SIGNAL_TEAM_REQUEST_EVENT_BODY_MARKER)
  );
}

function isDescriptionSeedCandidate(message: SignalChatMatrixMessage): boolean {
  if (isSignalTeamTimelineMessage(message.content)) return false;
  if (message.msgtype && message.msgtype !== 'm.text') return false;
  return message.content.trim().length > 0;
}

function descriptionsMatch(
  messageContent: string,
  description: string,
): boolean {
  const normalizedMessage =
    normalizeSignalDescriptionForChat(messageContent) ?? messageContent.trim();
  const normalizedDescription = normalizeSignalDescriptionForChat(description);
  if (!normalizedDescription) return false;
  return normalizedMessage === normalizedDescription;
}

function getChatTimelineMessages(
  messages: SignalChatMatrixMessage[],
): SignalChatMatrixMessage[] {
  return messages
    .filter(isDescriptionSeedCandidate)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Signal rooms no longer get the description posted into chat — the signal
 * page shows it. Older rooms still open with a copy; on edit, keep that copy
 * in step so it stays recognisable and is not counted as a reply. Rooms
 * without a copy are left alone, and real chat is never overwritten.
 */
export async function updateSignalDescriptionCopyInRoom({
  roomId,
  previousDescription,
  description,
  matrix,
}: {
  roomId: string;
  previousDescription?: string | null;
  description?: string | null;
  matrix: SignalChatMatrixOps;
}): Promise<void> {
  const nextDescription = normalizeSignalDescriptionForChat(description);
  if (!nextDescription || !roomId.trim()) return;
  const priorDescription =
    normalizeSignalDescriptionForChat(previousDescription);
  if (priorDescription === nextDescription) return;

  const canonicalRoomId = await matrix.joinRoom(roomId);
  await matrix.loadRoomHistory(canonicalRoomId);

  const firstMessage = getChatTimelineMessages(
    matrix.getRoomMessages(canonicalRoomId) ?? [],
  )[0];
  if (!firstMessage?.id) return;
  const isCopy =
    priorDescription != null &&
    descriptionsMatch(firstMessage.content, priorDescription);
  if (!isCopy) return;

  await matrix.editRoomMessage({
    roomId: canonicalRoomId,
    targetEventId: firstMessage.id,
    message: nextDescription,
  });
}
