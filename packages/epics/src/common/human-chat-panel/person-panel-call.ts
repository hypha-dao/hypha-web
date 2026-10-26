/** A listed Start-a-conversation row can still have a Matrix room id. */
export function hasHumanTimelineMessages(
  messages: readonly { isSynthetic?: boolean }[],
): boolean {
  return messages.some((message) => !message.isSynthetic);
}

/**
 * Phone / video on a person panel must not start Element Call when there is
 * no peer conversation yet (null room, Start-a-conversation, empty DM).
 */
export function shouldRefusePersonPanelCall(input: {
  isDirectConversation: boolean;
  roomId?: string | null;
  coherenceRoomId?: string | null;
  hasHumanMessages: boolean;
}): boolean {
  if (!input.isDirectConversation) return false;
  if (!input.roomId?.trim() || !input.coherenceRoomId?.trim()) return true;
  return !input.hasHumanMessages;
}

/**
 * Whether sidebar call chrome belongs to the chat being viewed.
 * A missing chat room matches only when there is also no call session —
 * otherwise a Start-a-conversation panel would inherit another room's banner.
 */
export function callAppliesToCurrentChatRoom(
  chatRoomId: string | null | undefined,
  sessionRoomId: string | null | undefined,
): boolean {
  const chat = chatRoomId?.trim() || null;
  const session = sessionRoomId?.trim() || null;
  if (!chat) return !session;
  if (!session) return true;
  return session === chat;
}

/** Shared phone/video entry: notice instead of starting a live call. */
export function runPersonPanelCallStart(input: {
  refuse: boolean;
  onRefuse: () => void;
  onStart: () => void;
}): void {
  if (input.refuse) {
    input.onRefuse();
    return;
  }
  input.onStart();
}
