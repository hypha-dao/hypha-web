const CALL_HOLD_CHANNEL = 'hypha-group-call-hold-v1';
const REMOTE_CALL_HOLD_MAX_AGE_MS = 90_000;

type CallHoldMessage =
  | { type: 'hold'; at: number }
  | { type: 'release'; at: number };

/** Tracks active group-call UI sessions so Matrix client recycle can defer during calls. */
let activeGroupCallSession = false;
let remoteCallHoldAt = 0;
const listeners = new Set<() => void>();

let callHoldChannel: BroadcastChannel | null = null;

function ensureCallHoldChannel(): BroadcastChannel | null {
  if (callHoldChannel) return callHoldChannel;
  if (typeof BroadcastChannel === 'undefined') return null;
  callHoldChannel = new BroadcastChannel(CALL_HOLD_CHANNEL);
  callHoldChannel.onmessage = (event) => {
    const data = event.data as CallHoldMessage;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'hold') {
      remoteCallHoldAt = data.at;
      return;
    }
    if (data.type === 'release') {
      remoteCallHoldAt = 0;
    }
  };
  return callHoldChannel;
}

function broadcastCallHold(active: boolean): void {
  const channel = ensureCallHoldChannel();
  if (!channel) return;
  try {
    channel.postMessage(
      active
        ? ({ type: 'hold', at: Date.now() } satisfies CallHoldMessage)
        : ({ type: 'release', at: Date.now() } satisfies CallHoldMessage),
    );
  } catch {
    // Ignore BroadcastChannel failures during unload.
  }
}

export function isRemoteGroupCallHoldActive(now = Date.now()): boolean {
  if (activeGroupCallSession) return true;
  if (!remoteCallHoldAt) return false;
  return now - remoteCallHoldAt <= REMOTE_CALL_HOLD_MAX_AGE_MS;
}

export function setGroupCallSessionActive(active: boolean): void {
  if (activeGroupCallSession === active) return;
  activeGroupCallSession = active;
  broadcastCallHold(active);
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
