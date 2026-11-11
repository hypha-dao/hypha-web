import { EventType } from 'matrix-js-sdk';
import { isSignalDescriptionCopy } from '../../../../core/src/coherence/signal-creator';

export type SignalRoomMessage = {
  sender: string;
  ts: number;
  body: string | null;
  /** Latest `m.replace` body for this message, when an edit is loaded. */
  editedBody?: string | null;
  /**
   * Hidden in the human chat (team roster, call, screenshare). Not a comment.
   */
  hidden?: boolean;
};

export type SignalRepliesSummary = {
  comments: number;
  people: number;
  lastReplyAt: number | null;
  lastReplySenderId: string | null;
};

/**
 * Replies in a signal room. Bot posts, copies of the signal description
 * (older rooms got the description posted into chat), and events the chat
 * hides are not replies, so they never count as a comment, a participant
 * or the last reply.
 */
export function summarizeSignalReplies(
  messages: readonly SignalRoomMessage[],
  description: string | null | undefined,
  { isBot }: { isBot: (sender: string) => boolean },
): SignalRepliesSummary {
  const senders = new Set<string>();
  let comments = 0;
  let lastReplyAt: number | null = null;
  let lastReplySenderId: string | null = null;
  for (const message of messages) {
    if (message.hidden) continue;
    if (isBot(message.sender)) continue;
    const isCopy = isSignalDescriptionCopy({
      messageContent: message.editedBody ?? message.body,
      signalDescription: description,
    });
    if (isCopy) continue;
    comments += 1;
    senders.add(message.sender);
    if (lastReplyAt == null || message.ts >= lastReplyAt) {
      lastReplyAt = message.ts;
      lastReplySenderId = message.sender;
    }
  }
  return {
    comments,
    people: senders.size,
    lastReplyAt,
    lastReplySenderId,
  };
}

/**
 * Whether this room's loaded timeline is the whole history.
 *
 * `scrollback()` reports the start by clearing `oldState.paginationToken`.
 * The live timeline's own backwards token is cleared on the first scrollback
 * even when older pages remain, so it is not a completeness check. An empty
 * timeline also has a null token before `/sync` delivers the room, so events
 * must be present, and `m.room.create` must be among them.
 */
export function timelineReachesRoomStart(room: {
  oldState?: { paginationToken: string | null } | null;
  getLiveTimeline(): {
    getEvents(): ReadonlyArray<{ getType(): string }>;
  };
}): boolean {
  const events = room.getLiveTimeline().getEvents();
  if (events.length === 0) return false;
  if (room.oldState?.paginationToken != null) return false;
  return events.some((event) => event.getType() === EventType.RoomCreate);
}

/**
 * Comment total for a signal. A timeline that reaches the room start is the
 * only source: that count is human replies the chat shows, without the
 * description seed, bot posts, or hidden notices. Until then the stored total
 * stands, and a shorter partial timeline cannot replace it.
 */
export function signalDiscussionCount(
  stored: number | null | undefined,
  activity?: { comments: number; reachesRoomStart: boolean } | null,
): number {
  const storedCount = stored ?? 0;
  if (!activity?.reachesRoomStart) {
    return Math.max(activity?.comments ?? 0, storedCount);
  }
  return activity.comments;
}

export function sameSignalRoomActivity<
  T extends SignalRepliesSummary & {
    lastReplySenderName: string | null;
    reachesRoomStart: boolean;
  },
>(a: T, b: T): boolean {
  return (
    a.comments === b.comments &&
    a.people === b.people &&
    a.lastReplyAt === b.lastReplyAt &&
    a.lastReplySenderId === b.lastReplySenderId &&
    a.lastReplySenderName === b.lastReplySenderName &&
    a.reachesRoomStart === b.reachesRoomStart
  );
}

/**
 * Name shown next to the last reply time. Hypha profile names win; a Matrix
 * display name is only used when it is a real name. Never returns a bridged
 * Privy id — `null` means show the time alone.
 */
export function signalLastReplierLabel({
  senderId,
  viewerMatrixId,
  viewerName,
  personName,
  matrixName,
}: {
  senderId: string | null | undefined;
  viewerMatrixId?: string | null;
  viewerName?: string | null;
  personName?: string | null;
  matrixName?: string | null;
}): string | null {
  const id = senderId?.trim();
  if (!id) return null;
  if (viewerMatrixId?.trim() === id && viewerName?.trim()) {
    return viewerName.trim();
  }
  return personName?.trim() || matrixName?.trim() || null;
}
