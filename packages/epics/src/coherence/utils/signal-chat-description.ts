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
  loadRoomHistory: (roomId: string) => Promise<void>;
  getRoomMessages: (roomId: string) => SignalChatMatrixMessage[] | null;
  sendMessage: (params: {
    roomId: string;
    message: string;
  }) => Promise<unknown>;
  editRoomMessage: (params: {
    roomId: string;
    targetEventId: string;
    message: string;
  }) => Promise<void>;
};

/**
 * - `safe`: seed empty rooms only; update the first message only when it already
 *   matches the description (avoids overwriting real chat on panel open).
 * - `save`: explicit save/create from the signal form — update or create the
 *   description anchor message.
 */
export type UpsertSignalDescriptionMode = 'safe' | 'save';

export function normalizeSignalDescriptionForChat(
  description?: string | null,
): string | null {
  if (!description) return null;
  const raw = description.trim();
  if (!raw) return null;

  // Rich text serialization may persist trailing spaces as HTML entities
  // (e.g. "&#x20;"), which Matrix then renders as literal text.
  const decodeHtmlEntities = (value: string): string =>
    value
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCodePoint(Number.parseInt(hex, 16)),
      )
      .replace(/&#(\d+);/g, (_, dec) =>
        String.fromCodePoint(Number.parseInt(dec, 10)),
      )
      .replace(/&nbsp;/gi, '\u00A0')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'");

  const decoded = decodeHtmlEntities(raw)
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

/** Post signal description as the first Matrix message, or update it on edit. */
export async function upsertSignalDescriptionInRoom({
  roomId,
  description,
  matrix,
  mode = 'save',
}: {
  roomId: string;
  description?: string | null;
  matrix: SignalChatMatrixOps;
  mode?: UpsertSignalDescriptionMode;
}): Promise<void> {
  const nextDescription = normalizeSignalDescriptionForChat(description);
  if (!nextDescription || !roomId.trim()) return;

  const canonicalRoomId = await matrix.joinRoom(roomId);
  await matrix.loadRoomHistory(canonicalRoomId);

  const chatMessages = getChatTimelineMessages(
    matrix.getRoomMessages(canonicalRoomId) ?? [],
  );
  const firstMessage = chatMessages[0];

  if (!firstMessage?.id) {
    await matrix.sendMessage({
      roomId: canonicalRoomId,
      message: nextDescription,
    });
    return;
  }

  if (mode === 'safe') {
    if (!descriptionsMatch(firstMessage.content, nextDescription)) {
      return;
    }
  }

  await matrix.editRoomMessage({
    roomId: canonicalRoomId,
    targetEventId: firstMessage.id,
    message: nextDescription,
  });
}
