import { claimProcessedEvent } from './dedupe';
import { resolveMaxEventAgeMs } from './duration';
import { resolveRoomToSpace } from './resolve-room-to-space';
import type {
  ChatNotificationEvent,
  ParsedMessageEvent,
  ReceiverDeps,
} from './types';

/** `event_type` marker for a message whose room maps to no known space/signal. */
export const UNMAPPED_EVENT_TYPE = 'm.room.message#unmapped';
export const MESSAGE_EVENT_TYPE = 'm.room.message';

export type IngestOutcome =
  | 'dispatched'
  | 'dispatch_failed'
  | 'duplicate'
  | 'ignored_bot'
  | 'ignored_stale'
  | 'ignored_unmapped';

type IngestDeps = Pick<ReceiverDeps, 'db' | 'dispatch'> & {
  botUserIds: Set<string>;
  logger: Pick<typeof console, 'info' | 'warn' | 'error'>;
  /** Test seams; default `Date.now` and `resolveMaxEventAgeMs()`. */
  now?: () => number;
  maxEventAgeMs?: number;
};

/**
 * Shared per-message pipeline used by both the live endpoint (`receiveTransaction`) and the
 * bounded reconciler. Resolve room→space (our DB only) → claim the event id
 * (insert-on-conflict-do-nothing) → hand a `ChatNotificationEvent` to `dispatch()`.
 *
 * Throws only on a durable-write failure (claim insert) — the caller turns that into a 5xx so
 * Dendrite retries. A `dispatch()` failure is swallowed (`'dispatch_failed'`): claim-before-
 * dispatch means the row is already committed and the event won't be retried (at-most-once).
 */
export async function ingestParsedMessage(
  parsed: ParsedMessageEvent,
  source: { txnId?: string },
  deps: IngestDeps,
): Promise<IngestOutcome> {
  const { db, dispatch, botUserIds, logger } = deps;

  if (botUserIds.has(parsed.senderMxid)) return 'ignored_bot';

  // Age guard, before any DB work and without recording the event: a stale event is never notified
  // (an outage replay would otherwise push hours-old messages all at once), and because the ledger
  // is pruned only well past this age, an already-recorded event whose row was pruned can never
  // slip through as a duplicate either.
  const ageMs = (deps.now ?? Date.now)() - parsed.occurredAt;
  if (ageMs > (deps.maxEventAgeMs ?? resolveMaxEventAgeMs())) {
    logger.info('[matrix-as] skipped stale event', {
      matrixEventId: parsed.matrixEventId,
      ageHours: Math.round(ageMs / 3_600_000),
    });
    return 'ignored_stale';
  }

  const context = await resolveRoomToSpace(parsed.roomId, db);

  if (!context) {
    await claimProcessedEvent(
      {
        matrixEventId: parsed.matrixEventId,
        roomId: parsed.roomId,
        eventType: UNMAPPED_EVENT_TYPE,
        txnId: source.txnId ?? null,
      },
      db,
    );
    return 'ignored_unmapped';
  }

  const claimed = await claimProcessedEvent(
    {
      matrixEventId: parsed.matrixEventId,
      roomId: parsed.roomId,
      eventType: MESSAGE_EVENT_TYPE,
      txnId: source.txnId ?? null,
    },
    db,
  );
  if (!claimed) return 'duplicate';

  const mentionsForOthers = parsed.mentionedMatrixUserIds.filter(
    (id) => id !== parsed.senderMxid,
  );

  const event: ChatNotificationEvent = {
    type: mentionsForOthers.length > 0 ? 'chat.mention' : 'chat.message',
    source: { kind: 'matrix', externalEventId: parsed.matrixEventId },
    roomId: parsed.roomId,
    actor: { externalUserId: parsed.senderMxid },
    context,
    payload: {
      body: parsed.body,
      mentionedMatrixUserIds: mentionsForOthers,
      occurredAt: parsed.occurredAt,
    },
  };

  try {
    await dispatch(event);
    return 'dispatched';
  } catch (error) {
    logger.error('[matrix-as] dispatch() failed for a claimed event', {
      matrixEventId: parsed.matrixEventId,
      roomId: parsed.roomId,
      error,
    });
    return 'dispatch_failed';
  }
}
