/** A listed Start-a-conversation row can still have a Matrix room id. */
export function hasHumanTimelineMessages(
  messages: readonly { isSynthetic?: boolean }[],
): boolean {
  return messages.some((message) => !message.isSynthetic);
}

export type PersonPanelCallPlan =
  | { action: 'refuse' }
  | { action: 'start'; roomId: string }
  | { action: 'ensure-then-start' };

export type PersonPanelCallInput = {
  isDirectConversation: boolean;
  roomId?: string | null;
  coherenceRoomId?: string | null;
  hasHumanMessages: boolean;
};

/**
 * Start-a-conversation / empty DMs are callable: ensure a real DM first.
 * Refuse only when the panel room and coherence room disagree (stale switch).
 */
export function planPersonPanelCall(
  input: PersonPanelCallInput,
): PersonPanelCallPlan {
  const room = input.roomId?.trim() || '';
  const coherence = input.coherenceRoomId?.trim() || '';
  if (!input.isDirectConversation) {
    return { action: 'start', roomId: room };
  }
  if (room && coherence && room !== coherence) return { action: 'refuse' };
  if (room && coherence && room === coherence && input.hasHumanMessages) {
    return { action: 'start', roomId: room };
  }
  return { action: 'ensure-then-start' };
}

export function shouldRefusePersonPanelCall(
  input: PersonPanelCallInput,
): boolean {
  return planPersonPanelCall(input).action === 'refuse';
}

/** A usable current DM: both ids present and they agree. */
export function matchedDirectRoomId(
  roomId?: string | null,
  coherenceRoomId?: string | null,
): string | null {
  const room = roomId?.trim() || '';
  const coherence = coherenceRoomId?.trim() || '';
  if (room && coherence && room === coherence) return room;
  return null;
}

export type PersonPanelCallSelection = {
  personId: number | null;
  title: string;
  roomId: string | null;
  coherenceRoomId: string | null;
};

export function personPanelCallSelectionOf(input: {
  personId?: number | null;
  title?: string | null;
  roomId?: string | null;
  coherenceRoomId?: string | null;
}): PersonPanelCallSelection {
  return {
    personId: input.personId && input.personId > 0 ? input.personId : null,
    title: input.title?.trim() || '',
    roomId: input.roomId?.trim() || null,
    coherenceRoomId: input.coherenceRoomId?.trim() || null,
  };
}

export function personPanelCallSelectionMatches(
  started: PersonPanelCallSelection,
  live: PersonPanelCallSelection,
): boolean {
  if (started.personId !== live.personId) return false;
  if (started.title !== live.title) return false;
  // Binding a room-less shell writes a room id — that is not a user switch.
  if (
    started.coherenceRoomId &&
    live.coherenceRoomId &&
    started.coherenceRoomId !== live.coherenceRoomId
  ) {
    return false;
  }
  if (started.roomId && live.roomId && started.roomId !== live.roomId) {
    return false;
  }
  return true;
}

export class PersonPanelCallAborted extends Error {
  readonly name = 'PersonPanelCallAborted';
  constructor() {
    super('Person panel call selection changed');
  }
}

/** Ensure a usable DM, then start the call against that room. */
export async function runPersonPanelCallPlan(input: {
  plan: PersonPanelCallPlan;
  ensureRoom: () => Promise<string>;
  onRefuse: () => void;
  onStart: (roomId: string) => void;
  isSelectionCurrent?: () => boolean;
}): Promise<void> {
  if (input.plan.action === 'refuse') {
    input.onRefuse();
    return;
  }
  if (input.plan.action === 'start') {
    if (input.isSelectionCurrent && !input.isSelectionCurrent()) return;
    input.onStart(input.plan.roomId);
    return;
  }
  const roomId = (await input.ensureRoom()).trim();
  if (!roomId) {
    throw new Error('Person panel call requires a Matrix room');
  }
  if (input.isSelectionCurrent && !input.isSelectionCurrent()) return;
  input.onStart(roomId);
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
