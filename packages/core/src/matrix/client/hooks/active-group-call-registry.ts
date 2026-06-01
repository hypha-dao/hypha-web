const CALL_HOLD_CHANNEL = 'hypha-group-call-hold-v1';
const REMOTE_CALL_HOLD_MAX_AGE_MS = 90_000;
const CALL_HOLD_REFRESH_MS = 30_000;

type CallHoldMessage =
  | { type: 'hold'; tabId: string; at: number }
  | { type: 'release'; tabId: string; at: number };

/** Tracks active group-call UI sessions so Matrix client recycle can defer during calls. */
let activeGroupCallSession = false;
const remoteCallHolds = new Map<string, number>();
const listeners = new Set<() => void>();

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
      remoteCallHolds.set(data.tabId, data.at);
      return;
    }
    if (data.type === 'release') {
      remoteCallHolds.delete(data.tabId);
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
  for (const [tabId, at] of remoteCallHolds) {
    if (now - at <= REMOTE_CALL_HOLD_MAX_AGE_MS) return true;
    remoteCallHolds.delete(tabId);
  }
  return false;
}

export function setGroupCallSessionActive(active: boolean): void {
  if (activeGroupCallSession === active) return;
  activeGroupCallSession = active;
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
  remoteCallHolds.clear();
  callHoldTabId = null;
  listeners.clear();
}
