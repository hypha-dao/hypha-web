import { isSignalDescriptionCopy } from '../../../../core/src/coherence/signal-creator';

export type SignalRoomMessage = {
  sender: string;
  ts: number;
  body: string | null;
  /** Latest `m.replace` body for this message, when an edit is loaded. */
  editedBody?: string | null;
};

export type SignalRepliesSummary = {
  comments: number;
  people: number;
  lastReplyAt: number | null;
  lastReplySenderId: string | null;
};

/**
 * Replies in a signal room. Bot posts and copies of the signal description
 * (older rooms got the description posted into chat) are not replies, so
 * they never count as a comment, a participant or the last reply.
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
    if (isBot(message.sender)) continue;
    const isCopy = [message.body, message.editedBody].some((content) =>
      isSignalDescriptionCopy({
        messageContent: content,
        signalDescription: description,
      }),
    );
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
