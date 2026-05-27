export type SignalChatMatrixOps = {
  joinRoom: (roomId: string) => Promise<string>;
  loadRoomHistory: (roomId: string) => Promise<void>;
  getRoomMessages: (
    roomId: string,
  ) => Array<{ id: string; timestamp: Date }> | null;
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

export function normalizeSignalDescriptionForChat(
  description?: string | null,
): string | null {
  if (!description) return null;
  const raw = description.trim();
  if (!raw) return null;

  // Rich text serialization may persist trailing spaces as HTML entities
  // (e.g. "&#x20;"), which Matrix then renders as literal text.
  const decodeHtmlEntities = (value: string): string => {
    if (typeof document === 'undefined') return value;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  };

  const decoded = decodeHtmlEntities(raw)
    .replace(/\u00A0/g, ' ')
    .trim();
  return decoded.length > 0 ? decoded : null;
}

/** Post signal description as the first Matrix message, or update it on edit. */
export async function upsertSignalDescriptionInRoom({
  roomId,
  description,
  matrix,
}: {
  roomId: string;
  description?: string | null;
  matrix: SignalChatMatrixOps;
}): Promise<void> {
  const nextDescription = normalizeSignalDescriptionForChat(description);
  if (!nextDescription || !roomId.trim()) return;

  const canonicalRoomId = await matrix.joinRoom(roomId);
  await matrix.loadRoomHistory(canonicalRoomId);

  const existingMessages = matrix.getRoomMessages(canonicalRoomId) ?? [];
  const firstMessage = [...existingMessages].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  )[0];

  if (!firstMessage?.id) {
    await matrix.sendMessage({
      roomId: canonicalRoomId,
      message: nextDescription,
    });
    return;
  }

  await matrix.editRoomMessage({
    roomId: canonicalRoomId,
    targetEventId: firstMessage.id,
    message: nextDescription,
  });
}
