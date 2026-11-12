import { isHiddenHumanChatMessageContent } from './human-chat-timeline-message';

const REPLACE_RELATION = 'm.replace';

export type HumanDiscussionTimelineEvent = {
  type: string;
  sender?: string | null;
  ts?: number;
  redacted?: boolean;
  /**
   * Set when the chat has already classified the event. Omit it to derive
   * the same answer from `content`.
   */
  hidden?: boolean;
  content?: Record<string, unknown> | null;
  /** Wire `m.relates_to`, when it is not on `content` (edited events). */
  relatesTo?: unknown;
};

export type HumanDiscussionSummary = {
  comments: number;
  people: number;
  lastReplyAt: number | null;
  lastReplySenderId: string | null;
};

function relatesToRecord(value: unknown): { rel_type?: string } | null {
  if (!value || typeof value !== 'object') return null;
  return value as { rel_type?: string };
}

/**
 * A timeline event the human chat paints as a person's bubble.
 *
 * The bubble list keeps a human message when its plaintext `body` happens to
 * equal the signal description, including the author's own message and a
 * message whose bubble actually renders `formatted_body` or the reply after
 * the quote fallback. Bot posts stay out: the bubble labels those as the
 * agent. Replace events are not their own bubble; the original is. Notices,
 * call posts and screenshare posts are the events the chat hides.
 */
export function isHumanChatBubbleEvent(
  event: HumanDiscussionTimelineEvent,
  isBot: (sender: string) => boolean,
): boolean {
  if (event.type !== 'm.room.message') return false;
  if (event.redacted) return false;
  const relates = relatesToRecord(
    event.relatesTo ?? event.content?.['m.relates_to'],
  );
  if (relates?.rel_type === REPLACE_RELATION) return false;
  const hidden =
    event.hidden ?? isHiddenHumanChatMessageContent(event.content ?? null);
  if (hidden) return false;
  const sender = event.sender?.trim();
  if (!sender || isBot(sender)) return false;
  return true;
}

/** Human bubbles in a signal room. One event, one comment, same as the chat. */
export function summarizeHumanDiscussionTimeline(
  events: readonly HumanDiscussionTimelineEvent[],
  { isBot }: { isBot: (sender: string) => boolean },
): HumanDiscussionSummary {
  const senders = new Set<string>();
  let comments = 0;
  let lastReplyAt: number | null = null;
  let lastReplySenderId: string | null = null;
  for (const event of events) {
    if (!isHumanChatBubbleEvent(event, isBot)) continue;
    const sender = event.sender!.trim();
    const ts = event.ts ?? 0;
    comments += 1;
    senders.add(sender);
    if (lastReplyAt == null || ts >= lastReplyAt) {
      lastReplyAt = ts;
      lastReplySenderId = sender;
    }
  }
  return {
    comments,
    people: senders.size,
    lastReplyAt,
    lastReplySenderId,
  };
}

/** One `/messages` chunk item, in the shape the chat's live timeline uses. */
export function humanDiscussionEventFromMatrixWire(
  value: unknown,
): HumanDiscussionTimelineEvent | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as Record<string, unknown>;
  const type = typeof event.type === 'string' ? event.type : '';
  if (!type) return null;
  const unsigned = event.unsigned as { redacted_because?: unknown } | undefined;
  const content =
    event.content && typeof event.content === 'object'
      ? (event.content as Record<string, unknown>)
      : null;
  return {
    type,
    sender: typeof event.sender === 'string' ? event.sender : null,
    ts: typeof event.origin_server_ts === 'number' ? event.origin_server_ts : 0,
    redacted: Boolean(unsigned?.redacted_because),
    content,
    relatesTo: content?.['m.relates_to'],
  };
}

const DISCUSSION_PAGE_CAP = 40;

/**
 * Walk `/messages?dir=b` until the homeserver omits the next token. A capped
 * walk is not the whole room and must not replace a stored count.
 */
export async function collectDiscussionTimeline(
  listPage: (from?: string) => Promise<{ chunk: unknown[]; end?: string }>,
): Promise<{
  events: HumanDiscussionTimelineEvent[];
  reachedStart: boolean;
}> {
  const events: HumanDiscussionTimelineEvent[] = [];
  const seenTokens = new Set<string>();
  let from: string | undefined;
  for (let page = 0; page < DISCUSSION_PAGE_CAP; page += 1) {
    const batch = await listPage(from);
    for (const item of batch.chunk) {
      const event = humanDiscussionEventFromMatrixWire(item);
      if (event) events.push(event);
    }
    const next = batch.end?.trim();
    // Spec: `end` is omitted once the backwards walk reaches the start.
    // An empty chunk or a repeated token is not that signal, and writing
    // from it would store a partial total.
    if (!next) {
      return { events, reachedStart: true };
    }
    if (batch.chunk.length === 0 || seenTokens.has(next)) {
      return { events, reachedStart: false };
    }
    seenTokens.add(next);
    from = next;
  }
  return { events, reachedStart: false };
}
