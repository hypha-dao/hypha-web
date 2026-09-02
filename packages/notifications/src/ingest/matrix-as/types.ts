import type { DatabaseInstance } from '@hypha-platform/core/server';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Matrix Application Service transaction receiver — types (#2483)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The receiver is a framework-agnostic core (`receiveTransaction`) plus a thin
 * Next.js route adapter (`apps/web/src/app/_matrix/app/v1/...`). #2484 moves the
 * core to `apps/api` once that service is redeployed — nothing here imports
 * `next/*`.
 *
 * The receiver's job ends at `dispatch(event)`. Recipient resolution, strategy,
 * consent gating and channel delivery all belong to #2470's redesign.
 */

// ── Matrix wire shapes (only the fields we read) ────────────────────────────

export interface MatrixEvent {
  type?: string;
  event_id?: string;
  room_id?: string;
  sender?: string;
  origin_server_ts?: number;
  content?: MatrixMessageContent;
  state_key?: string;
}

export interface MatrixMessageContent {
  msgtype?: string;
  body?: string;
  formatted_body?: string;
  format?: string;
  ['m.mentions']?: { user_ids?: string[] };
  [key: string]: unknown;
}

/** Body of `PUT /_matrix/app/v1/transactions/{txnId}`. */
export interface MatrixTransactionBody {
  events?: MatrixEvent[];
  // `ephemeral`, `to_device`, `device_lists`, … — ignored by v1.
  [key: string]: unknown;
}

// ── Normalised message (internal, post-parse) ──────────────────────────────

export interface ParsedMessageEvent {
  matrixEventId: string;
  roomId: string;
  senderMxid: string;
  body: string;
  mentionedMatrixUserIds: string[];
  occurredAt: number;
}

// ── Room → Hypha context (resolved from our DB, never the payload) ─────────

export type RoomSpaceContext =
  | { kind: 'space'; spaceId: number; spaceSlug: string }
  | {
      kind: 'signal';
      spaceId: number;
      spaceSlug: string;
      coherenceId: number;
    };

// ── Hand-off contract to #2470's dispatch() ───────────────────────────────
//
// Proposed default shape. #2470 holds adjustment rights on field names when it
// wires dispatch() — settle in a short joint pass (spec §14). The substance
// (event id / room-derived context / actor / raw body + mentions / timestamp)
// is what #2470 implementation-plan §2 already implies.

export type ChatNotificationEventType = 'chat.message' | 'chat.mention';

export interface ChatNotificationEvent {
  type: ChatNotificationEventType;
  /** Idempotency key for the whole notification pipeline (#2470 §3.A.1). */
  source: { kind: 'matrix'; matrixEventId: string };
  /**
   * Matrix room the event was sent in. Additive field carried for consumers that reply back
   * into the room (#2485 AI-bot POC). #2470 keeps naming-adjustment rights like the rest of
   * this contract; the substance (which room) is stable.
   */
  roomId: string;
  /** The Matrix sender. #2470's resolver excludes this identity from recipients. */
  actor: { matrixUserId: string };
  context: RoomSpaceContext;
  payload: {
    /** Raw message body. #2470's delivery layer sanitises/truncates for push/email. */
    body: string;
    /** Matrix user ids explicitly mentioned. `[]` for `chat.message`. */
    mentionedMatrixUserIds: string[];
    /** `origin_server_ts` of the Matrix event (ms since epoch). */
    occurredAt: number;
  };
}

/**
 * The seam to #2470. Until #2470's real `dispatch()` lands, the route wires
 * `loggingDispatch` (see `logging-dispatch.ts`).
 */
export type NotificationDispatch = (
  event: ChatNotificationEvent,
) => Promise<void>;

// ── Receiver dependencies (injected — keeps the core testable & portable) ──

export interface ReceiverDeps {
  db: DatabaseInstance;
  dispatch: NotificationDispatch;
  /** MXIDs whose own messages must never trigger a notification (the AS bots). */
  botUserIds: string[];
  now?: () => number;
  logger?: Pick<typeof console, 'info' | 'warn' | 'error'>;
}

export interface ReceiveTransactionInput {
  txnId: string;
  body: MatrixTransactionBody;
}

export interface ReceiveResult {
  /** Events successfully handed to `dispatch()` this call. */
  dispatched: number;
  /** `dispatch()` threw — logged and swallowed (claim-before-dispatch, at-most-once; spec §13). */
  dispatchFailures: number;
  /** Events already in the dedupe ledger (skipped). */
  duplicates: number;
  /** Events dropped (wrong type, `m.notice`, bot-sent, unmapped room). */
  ignored: number;
}
