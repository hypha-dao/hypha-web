export type SignalThreadCallPlan =
  | { action: 'refuse'; reason: 'not-signal' }
  | { action: 'start'; roomId: string }
  | { action: 'ensure-then-start' };

export class SignalThreadCallAborted extends Error {
  readonly name = 'SignalThreadCallAborted';
  constructor() {
    super('Signal thread call selection changed');
  }
}

/**
 * A persisted signal room with no Matrix type is a legacy signal room.
 * Any other Hypha room type (space, DM, group, proposal, …) is not this signal.
 */
export function signalCallRoomIsOwned(
  roomType: string | null | undefined,
  ownedRoomType: string,
): boolean {
  if (!roomType) return true;
  return roomType === ownedRoomType;
}

/**
 * Each signal calls in its own room. An empty discussion does not refuse:
 * the caller ensures that room, persists it, then starts. A live room id that
 * belongs to another chat is ignored when this signal already has its own id.
 */
export function planSignalThreadCall({
  isSignalThread,
  signalSlug,
  coherenceRoomId,
  coherenceRoomType,
  ownedRoomType,
  spaceRoomId,
  directRoomId,
}: {
  isSignalThread: boolean;
  signalSlug?: string | null;
  coherenceRoomId?: string | null;
  coherenceRoomType?: string | null;
  /** Matrix `m.room.create` type of a signal discussion room. */
  ownedRoomType: string;
  spaceRoomId?: string | null;
  directRoomId?: string | null;
}): SignalThreadCallPlan {
  const slug = signalSlug?.trim() ?? '';
  if (!isSignalThread || !slug) {
    return { action: 'refuse', reason: 'not-signal' };
  }
  const coherence = coherenceRoomId?.trim() || '';
  const forbidden = new Set(
    [spaceRoomId?.trim() || '', directRoomId?.trim() || ''].filter(Boolean),
  );
  if (
    coherence &&
    !forbidden.has(coherence) &&
    signalCallRoomIsOwned(coherenceRoomType, ownedRoomType)
  ) {
    return { action: 'start', roomId: coherence };
  }
  return { action: 'ensure-then-start' };
}

/**
 * The room a signal call may start in. Throws for a space room, a DM, or a
 * room already created for a different signal. Never returns a forbidden id.
 */
export function assertSignalCallRoom({
  roomId,
  spaceRoomId,
  directRoomId,
  otherSignalRoomIds,
}: {
  roomId: string;
  spaceRoomId?: string | null;
  directRoomId?: string | null;
  otherSignalRoomIds?: readonly string[];
}): string {
  const id = roomId.trim();
  if (!id) throw new Error('Signal call requires a Matrix room');
  const space = spaceRoomId?.trim() || '';
  const direct = directRoomId?.trim() || '';
  if (space && id === space) {
    throw new Error('Signal call must not use the space room');
  }
  if (direct && id === direct) {
    throw new Error('Signal call must not use a direct room');
  }
  const others = new Set(
    (otherSignalRoomIds ?? []).map((room) => room.trim()).filter(Boolean),
  );
  if (others.has(id)) {
    throw new Error('Signal call must not use another signal room');
  }
  return id;
}

/**
 * One in-flight create per signal slug, plus a cache of rooms already created
 * in this session. A failed create clears the in-flight slot and does not cache.
 */
export function takeCoherenceRoomCreate<T extends { roomId: string }>(
  cache: Map<string, string>,
  inFlight: Map<string, Promise<T>>,
  slug: string,
  create: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(slug);
  if (cached) return Promise.resolve({ roomId: cached } as T);
  const pending = inFlight.get(slug);
  if (pending) return pending;
  const created = create().then((result) => {
    const roomId = result.roomId?.trim();
    if (roomId) cache.set(slug, roomId);
    return result;
  });
  inFlight.set(slug, created);
  const clear = () => {
    if (inFlight.get(slug) === created) inFlight.delete(slug);
  };
  created.then(clear, clear);
  return created;
}

/**
 * Join the signal room when this client is not already in it, then start.
 * `ensureRoom` must persist the room before resolving. A changed selection
 * (`isCurrent` false) skips start and does not join a room the user left.
 */
export async function runSignalThreadCallPlan({
  plan,
  ensureRoom,
  joinRoom,
  currentRoomId,
  onStart,
  isCurrent,
}: {
  plan: SignalThreadCallPlan;
  ensureRoom: () => Promise<string>;
  joinRoom?: (roomId: string) => Promise<void>;
  currentRoomId?: string | null;
  onStart: (roomId: string) => void;
  isCurrent?: () => boolean;
}): Promise<void> {
  if (plan.action === 'refuse') return;
  const current = () => (isCurrent ? isCurrent() : true);
  if (!current()) return;

  const target =
    plan.action === 'start' ? plan.roomId.trim() : (await ensureRoom()).trim();
  if (!target) throw new Error('Signal call requires a Matrix room');
  if (!current()) return;

  const alreadyHere = (currentRoomId?.trim() || '') === target;
  if (!alreadyHere && joinRoom) {
    await joinRoom(target);
    if (!current()) return;
  }
  onStart(target);
}

/** Call chrome, including a signal thread whose room does not exist yet. */
export function signalCallChromeAllowed({
  isMatrixAvailable,
  isMatrixAuthenticated,
  isSpaceMember,
  isDirectConversation,
  roomId,
  isStartConversation,
  isSignalCallThread,
  blockSpaceChatForMembership,
}: {
  isMatrixAvailable: boolean;
  isMatrixAuthenticated: boolean;
  isSpaceMember: boolean;
  isDirectConversation: boolean;
  roomId?: string | null;
  isStartConversation: boolean;
  isSignalCallThread: boolean;
  blockSpaceChatForMembership: boolean;
}): boolean {
  if (blockSpaceChatForMembership) return false;
  if (!isMatrixAvailable || !isMatrixAuthenticated) return false;
  if (!isSpaceMember && !isDirectConversation) return false;
  return Boolean(roomId?.trim()) || isStartConversation || isSignalCallThread;
}

/**
 * Space, proposal, and context chats keep their toolbar. A coherence slug is
 * a signal call only when it is that signal's private thread — not a public
 * or space-slug room.
 */
export function showSignalCallToolbar({
  showSidebarCallChrome,
  isSignalThread,
  isSignalCallThread,
}: {
  showSidebarCallChrome: boolean;
  isSignalThread: boolean;
  isSignalCallThread: boolean;
}): boolean {
  return showSidebarCallChrome && (!isSignalThread || isSignalCallThread);
}
