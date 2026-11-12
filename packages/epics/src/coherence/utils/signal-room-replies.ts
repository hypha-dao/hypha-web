import { EventType } from 'matrix-js-sdk';
import { summarizeHumanDiscussionTimeline } from '../../../../core/src/matrix/human-discussion-count';

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
 * Human bubbles in a signal room. Bot posts and events the chat hides are
 * not comments. A person's own message still counts when its plaintext body
 * matches the signal description: the bubble renders that message (often via
 * `formatted_body` or the text after a reply quote), and the count uses the
 * same predicate.
 */
export function summarizeSignalReplies(
  messages: readonly SignalRoomMessage[],
  { isBot }: { isBot: (sender: string) => boolean },
): SignalRepliesSummary {
  return summarizeHumanDiscussionTimeline(
    messages.map((message) => ({
      type: 'm.room.message',
      sender: message.sender,
      ts: message.ts,
      hidden: message.hidden,
      content: { body: message.editedBody ?? message.body },
    })),
    { isBot },
  );
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
 * only live source: that count is the human bubbles the chat shows. Until
 * then the stored total stands, and a shorter partial timeline cannot
 * replace it.
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
