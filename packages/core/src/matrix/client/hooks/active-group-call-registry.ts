const CALL_HOLD_CHANNEL = 'hypha-group-call-hold-v1';
const REMOTE_CALL_HOLD_MAX_AGE_MS = 90_000;
const CALL_HOLD_REFRESH_MS = 30_000;

type CallHoldMessage =
  | { type: 'hold'; tabId: string; at: number; roomId: string | null }
  | { type: 'release'; tabId: string; at: number }
  /** #2456 D2d: broadcast by a tab about to join a *different* room, asking whichever tab of
   * this browser currently holds an active call to tear it down first. */
  | { type: 'please-leave'; tabId: string; at: number };

type RemoteCallHold = { at: number; roomId: string | null };

/** Tracks active group-call UI sessions so Matrix client recycle can defer during calls. */
let activeGroupCallSession = false;
let activeGroupCallRoomId: string | null = null;
const remoteCallHolds = new Map<string, RemoteCallHold>();
const listeners = new Set<() => void>();
const pleaseLeaveListeners = new Set<() => void>();

let callHoldChannel: BroadcastChannel | null = null;
let callHoldTabId: string | null = null;
let callHoldRefreshTimer: ReturnType<typeof setInterval> | null = null;

function createHoldTabId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `call-tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ensureCallHoldChannel(): BroadcastChannel | null {
  if (callHoldChannel) return callHoldChannel;
  if (typeof BroadcastChannel === 'undefined') return null;
  callHoldChannel = new BroadcastChannel(CALL_HOLD_CHANNEL);
  callHoldChannel.onmessage = (event) => {
    const data = event.data as CallHoldMessage;
    if (!data || typeof data !== 'object' || typeof data.tabId !== 'string') {
      return;
    }
    if (data.type === 'hold') {
      remoteCallHolds.set(data.tabId, { at: data.at, roomId: data.roomId });
      return;
    }
    if (data.type === 'release') {
      remoteCallHolds.delete(data.tabId);
      return;
    }
    if (data.type === 'please-leave' && data.tabId !== callHoldTabId) {
      if (!activeGroupCallSession) return;
      for (const listener of pleaseLeaveListeners) {
        listener();
      }
    }
  };
  return callHoldChannel;
}

function broadcastCallHold(active: boolean): void {
  const channel = ensureCallHoldChannel();
  if (!channel || !callHoldTabId) return;
  try {
    channel.postMessage(
      active
        ? ({
            type: 'hold',
            tabId: callHoldTabId,
            at: Date.now(),
            roomId: activeGroupCallRoomId,
          } satisfies CallHoldMessage)
        : ({
            type: 'release',
            tabId: callHoldTabId,
            at: Date.now(),
          } satisfies CallHoldMessage),
    );
  } catch {
    // Ignore BroadcastChannel failures during unload.
  }
}

/** #2456 D2d: ask whichever tab of this browser currently holds an active call to leave. */
export function requestRemoteGroupCallLeave(): void {
  const channel = ensureCallHoldChannel();
  if (!channel) return;
  if (!callHoldTabId) {
    callHoldTabId = createHoldTabId();
  }
  try {
    channel.postMessage({
      type: 'please-leave',
      tabId: callHoldTabId,
      at: Date.now(),
    } satisfies CallHoldMessage);
  } catch {
    // Ignore BroadcastChannel failures during unload.
  }
}

/** #2456 D2d: called by the tab currently holding a call when another tab asks it to leave. */
export function subscribeGroupCallPleaseLeave(
  listener: () => void,
): () => void {
  ensureCallHoldChannel();
  pleaseLeaveListeners.add(listener);
  return () => {
    pleaseLeaveListeners.delete(listener);
  };
}

function startCallHoldRefresh(): void {
  stopCallHoldRefresh();
  if (!callHoldTabId) {
    callHoldTabId = createHoldTabId();
  }
  broadcastCallHold(true);
  callHoldRefreshTimer = setInterval(() => {
    broadcastCallHold(true);
  }, CALL_HOLD_REFRESH_MS);
}

function stopCallHoldRefresh(): void {
  if (!callHoldRefreshTimer) return;
  clearInterval(callHoldRefreshTimer);
  callHoldRefreshTimer = null;
}

export function isRemoteGroupCallHoldActive(now = Date.now()): boolean {
  if (activeGroupCallSession) return true;
  for (const [tabId, hold] of remoteCallHolds) {
    if (now - hold.at <= REMOTE_CALL_HOLD_MAX_AGE_MS) return true;
    remoteCallHolds.delete(tabId);
  }
  return false;
}

/**
 * #2456 D2d: whether a fresh remote hold from *another* tab of this browser exists, and if so
 * which room it's for. Deliberately excludes this tab's own session (unlike
 * `isRemoteGroupCallHoldActive`, which counts it as "held" for Matrix-client-recycle purposes) —
 * this is specifically for detecting a *different* tab's call to offer the "Leave & Join"
 * cross-tab switch.
 *
 * Returns `null` only when there's no active remote hold at all — distinct from a hold whose
 * `roomId` is itself `null` (the holder broadcast before its own `activeRoomId` was known yet,
 * e.g. mid-`restoreInProgressRef`). Callers must check hold *presence* via the return value being
 * non-null, not by testing `roomId` truthiness, or a hold with an unknown room silently reads as
 * "no hold" and skips the cross-tab switch confirmation entirely.
 */
export function getRemoteGroupCallHold(
  now = Date.now(),
): { roomId: string | null } | null {
  for (const [tabId, hold] of remoteCallHolds) {
    if (now - hold.at <= REMOTE_CALL_HOLD_MAX_AGE_MS) {
      return { roomId: hold.roomId };
    }
    remoteCallHolds.delete(tabId);
  }
  return null;
}

export function setGroupCallSessionActive(
  active: boolean,
  roomId: string | null = null,
): void {
  if (activeGroupCallSession === active && activeGroupCallRoomId === roomId) {
    return;
  }
  activeGroupCallSession = active;
  activeGroupCallRoomId = active ? roomId : null;
  if (active) {
    if (!callHoldTabId) {
      callHoldTabId = createHoldTabId();
    }
    startCallHoldRefresh();
  } else {
    stopCallHoldRefresh();
    broadcastCallHold(false);
  }
  for (const listener of listeners) {
    listener();
  }
}

export function isGroupCallSessionActive(): boolean {
  return activeGroupCallSession;
}

export function subscribeGroupCallSessionActive(
  listener: () => void,
): () => void {
  ensureCallHoldChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset for module state between vitest cases. */
export function resetGroupCallSessionRegistryForTests(): void {
  stopCallHoldRefresh();
  activeGroupCallSession = false;
  activeGroupCallRoomId = null;
  remoteCallHolds.clear();
  callHoldTabId = null;
  listeners.clear();
  pleaseLeaveListeners.clear();
}
