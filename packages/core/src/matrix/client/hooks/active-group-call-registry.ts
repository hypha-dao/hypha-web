/** Tracks active group-call UI sessions so Matrix client recycle can defer during calls. */
let activeGroupCallSession = false;
const listeners = new Set<() => void>();

export function setGroupCallSessionActive(active: boolean): void {
  if (activeGroupCallSession === active) return;
  activeGroupCallSession = active;
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
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
