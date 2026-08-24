let cachedTabId: string | null = null;

/** Stable, per-browser-tab identity. Not related to Matrix's server-issued deviceId, which is shared
 * across all tabs of one login — this is a client-only value for disambiguating tabs (LiveKit
 * identity uniqueness, same-browser/same-room rejoin detection). */
export function getTabId(): string {
  if (cachedTabId) {
    return cachedTabId;
  }
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    cachedTabId = crypto.randomUUID();
  } else {
    cachedTabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return cachedTabId;
}
