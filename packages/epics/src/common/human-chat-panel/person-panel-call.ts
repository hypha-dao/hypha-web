/** A listed Start-a-conversation row can still have a Matrix room id. */
export function hasHumanTimelineMessages(
  messages: readonly { isSynthetic?: boolean }[],
): boolean {
  return messages.some((message) => !message.isSynthetic);
}

/**
 * Phone / video on a person panel must not start Element Call when the
 * direct conversation has no room yet, or when the panel room disagrees
 * with the coherence room (stale bind during a switch). An existing joined
 * DM is callable even if the timeline is still empty.
 * `hasHumanMessages` is unused for refusal; callers may still pass it.
 */
export function shouldRefusePersonPanelCall(input: {
  isDirectConversation: boolean;
  roomId?: string | null;
  coherenceRoomId?: string | null;
  hasHumanMessages: boolean;
}): boolean {
  if (!input.isDirectConversation) return false;
  if (!input.roomId?.trim() || !input.coherenceRoomId?.trim()) return true;
  if (input.roomId.trim() !== input.coherenceRoomId.trim()) return true;
  return false;
}

/**
 * On a refused person-panel call, leave only leftover chrome for this room
 * (or no session). A live call owned by another room must stay up.
 */
export function shouldLeaveCallOnPersonPanelRefuse(
  sessionRoomId: string | null | undefined,
  currentRoomId: string | null | undefined,
): boolean {
  const session = sessionRoomId?.trim() || null;
  if (!session) return true;
  const current = currentRoomId?.trim() || null;
  return session === current;
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
