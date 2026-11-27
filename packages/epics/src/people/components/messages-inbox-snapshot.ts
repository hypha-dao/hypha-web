import type { ConversationRow } from './member-connections';
import type { JoinedChannelSnapshot } from './messages-inbox';

const INBOX_SNAPSHOT_KEY = 'hypha.messages-inbox-snapshot';
const MAX_SNAPSHOT_ROWS = 40;

export type InboxListSnapshot = {
  rows: ConversationRow[];
  channels: JoinedChannelSnapshot[];
};

const EMPTY_SNAPSHOT: InboxListSnapshot = { rows: [], channels: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isConversationRow(value: unknown): value is ConversationRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.roomId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.preview === 'string' &&
    typeof value.mine === 'boolean' &&
    (value.kind === 'person' || value.kind === 'group')
  );
}

function isChannelSnapshot(value: unknown): value is JoinedChannelSnapshot {
  if (!isRecord(value)) return false;
  return (
    typeof value.roomId === 'string' &&
    typeof value.roomType === 'string' &&
    typeof value.name === 'string' &&
    typeof value.preview === 'string' &&
    Array.isArray(value.aliases)
  );
}

export function readInboxListSnapshot(
  accountId: string | null | undefined,
): InboxListSnapshot {
  if (typeof window === 'undefined' || !accountId) return EMPTY_SNAPSHOT;
  try {
    const raw = window.sessionStorage.getItem(INBOX_SNAPSHOT_KEY);
    if (!raw) return EMPTY_SNAPSHOT;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return EMPTY_SNAPSHOT;
    const storedAccount =
      typeof parsed.accountId === 'string' ? parsed.accountId : '';
    if (!storedAccount || storedAccount !== accountId) return EMPTY_SNAPSHOT;
    const rows = Array.isArray(parsed.rows)
      ? parsed.rows.filter(isConversationRow).slice(0, MAX_SNAPSHOT_ROWS)
      : [];
    const channels = Array.isArray(parsed.channels)
      ? parsed.channels.filter(isChannelSnapshot).slice(0, MAX_SNAPSHOT_ROWS)
      : [];
    return { rows, channels };
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export function writeInboxListSnapshot(
  snapshot: InboxListSnapshot,
  accountId: string | null | undefined,
): void {
  if (typeof window === 'undefined' || !accountId) return;
  if (snapshot.rows.length === 0 && snapshot.channels.length === 0) {
    clearInboxListSnapshot();
    return;
  }
  try {
    const payload = {
      accountId,
      rows: snapshot.rows.slice(0, MAX_SNAPSHOT_ROWS),
      channels: snapshot.channels.slice(0, MAX_SNAPSHOT_ROWS),
    };
    window.sessionStorage.setItem(INBOX_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    // Private mode can block session storage. The live list still works.
  }
}

export function clearInboxListSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(INBOX_SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}

/**
 * A reconnect paints an empty store before IndexedDB catch-up. Keep the
 * snapshot the reader already saw instead of flashing the skeleton.
 */
export function keepPaintedInboxRows<T>(
  current: readonly T[],
  next: readonly T[],
  liveSyncReady: boolean,
): readonly T[] {
  if (next.length === 0 && current.length > 0 && !liveSyncReady) return current;
  return next;
}
