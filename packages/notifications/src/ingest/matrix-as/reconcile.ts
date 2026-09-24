import { isNotNull } from 'drizzle-orm';
import { coherences, spaces } from '@hypha-platform/storage-postgres';
import {
  getMatrixBotAsToken,
  getMatrixHomeserverUrl,
  matrixListRoomMessages,
  type DatabaseInstance,
} from '@hypha-platform/core/server';
import { getSuppressedBotUserIds } from './bot-identities';
import { ingestParsedMessage } from './ingest-message';
import { loggingDispatch } from './logging-dispatch';
import { parseMessageEvent } from './parse-message-event';
import { resolveReconcileWindowMs } from './duration';
import type { MatrixEvent, NotificationDispatch } from './types';

export interface ReconcileOptions {
  /** Only events newer than `now - windowMs` are considered. Default: `NOTIFICATION_RECONCILE_WINDOW` or 6h. */
  windowMs?: number;
  /** Messages to read per room (backwards from the tip). Default 100. */
  perRoomLimit?: number;
  /** Safety cap on rooms scanned per run. Default 1000. */
  maxRooms?: number;
}

export interface ReconcileDeps {
  db: DatabaseInstance;
  dispatch?: NotificationDispatch;
  homeserverUrl?: string | null;
  botAccessToken?: string | null;
  botUserIds?: string[];
  now?: () => number;
  logger?: Pick<typeof console, 'info' | 'warn' | 'error'>;
}

export interface ReconcileResult {
  ok: boolean;
  reason?: string;
  roomsScanned: number;
  eventsSeen: number;
  dispatched: number;
  dispatchFailures: number;
  duplicates: number;
  ignored: number;
  outOfWindow: number;
  roomErrors: number;
}

const EMPTY: ReconcileResult = {
  ok: true,
  roomsScanned: 0,
  eventsSeen: 0,
  dispatched: 0,
  dispatchFailures: 0,
  duplicates: 0,
  ignored: 0,
  outOfWindow: 0,
  roomErrors: 0,
};

/** Distinct Matrix room ids Hypha knows about (space chat rooms + signal thread rooms). */
async function listKnownRoomIds(
  db: DatabaseInstance,
  cap: number,
): Promise<string[]> {
  const [spaceRooms, signalRooms] = await Promise.all([
    db
      .select({ roomId: spaces.chatRoomId })
      .from(spaces)
      .where(isNotNull(spaces.chatRoomId)),
    db
      .select({ roomId: coherences.roomId })
      .from(coherences)
      .where(isNotNull(coherences.roomId)),
  ]);

  const ids = new Set<string>();
  for (const { roomId } of [...spaceRooms, ...signalRooms]) {
    const trimmed = roomId?.trim();
    if (trimmed) ids.add(trimmed);
  }
  return [...ids].slice(0, cap);
}

/**
 * Bounded backstop for the AS endpoint (#2483 spec §4): walk the recent timeline of every known
 * room and run any `m.room.message` not yet in `notification_processed_events` through the same
 * pipeline the live endpoint uses. Shares `ingestParsedMessage` → the event-id claim dedupes
 * against both the live path and concurrent reconcile runs.
 *
 * Intended trigger: the `/api/cron/notification-reconcile` route, every 15 minutes (spec §13).
 * Time-bounded, never a full historical backfill.
 */
export async function reconcileMatrixNotifications(
  options: ReconcileOptions,
  deps: ReconcileDeps,
): Promise<ReconcileResult> {
  const logger = deps.logger ?? console;
  const now = deps.now ?? Date.now;
  const windowMs = options.windowMs ?? resolveReconcileWindowMs();
  const perRoomLimit = Math.max(1, Math.min(1000, options.perRoomLimit ?? 100));
  const maxRooms = Math.max(1, options.maxRooms ?? 1000);

  const homeserverUrl = deps.homeserverUrl ?? getMatrixHomeserverUrl() ?? null;
  const botAccessToken = deps.botAccessToken ?? getMatrixBotAsToken() ?? null;

  if (!homeserverUrl || !botAccessToken) {
    return {
      ...EMPTY,
      ok: false,
      reason: 'matrix homeserver url or bot token not configured',
    };
  }

  const dispatch = deps.dispatch ?? loggingDispatch;
  const botUserIds = new Set(
    (deps.botUserIds ?? getSuppressedBotUserIds())
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const cutoff = now() - windowMs;

  const roomIds = await listKnownRoomIds(deps.db, maxRooms);
  const result: ReconcileResult = { ...EMPTY, ok: true };

  for (const roomId of roomIds) {
    result.roomsScanned += 1;
    try {
      const { chunk } = await matrixListRoomMessages(
        roomId,
        botAccessToken,
        homeserverUrl,
        { limit: perRoomLimit },
      );

      for (const raw of chunk as MatrixEvent[]) {
        const parsed = parseMessageEvent(raw);
        if (!parsed) {
          result.ignored += 1;
          continue;
        }
        result.eventsSeen += 1;

        // chunk is newest-first (dir=b); once we cross the window, older events follow.
        if (parsed.occurredAt < cutoff) {
          result.outOfWindow += 1;
          break;
        }

        const outcome = await ingestParsedMessage(
          parsed,
          {},
          { db: deps.db, dispatch, botUserIds, logger },
        );
        switch (outcome) {
          case 'dispatched':
            result.dispatched += 1;
            break;
          case 'dispatch_failed':
            result.dispatchFailures += 1;
            break;
          case 'duplicate':
            result.duplicates += 1;
            break;
          default:
            result.ignored += 1;
        }
      }
    } catch (error) {
      result.roomErrors += 1;
      logger.warn('[matrix-as] reconcile: room scan failed', { roomId, error });
    }
  }

  return result;
}
