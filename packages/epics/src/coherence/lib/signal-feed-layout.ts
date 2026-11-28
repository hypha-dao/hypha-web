export const SIGNAL_FEED_LAYOUTS = ['list', 'cards'] as const;

export type SignalFeedLayout = (typeof SIGNAL_FEED_LAYOUTS)[number];

export const DEFAULT_SIGNAL_FEED_LAYOUT = 'list' satisfies SignalFeedLayout;

/** One preference for the signed-in browser, shared across spaces. */
export const SIGNAL_FEED_LAYOUT_STORAGE_KEY = 'hypha.coherenceFeedLayout';

export function parseSignalFeedLayout(
  raw: string | null | undefined,
): SignalFeedLayout | null {
  if (raw === 'list' || raw === 'cards') return raw;
  return null;
}

export function readStoredSignalFeedLayout(): SignalFeedLayout {
  if (typeof window === 'undefined') return DEFAULT_SIGNAL_FEED_LAYOUT;
  try {
    return (
      parseSignalFeedLayout(
        window.localStorage.getItem(SIGNAL_FEED_LAYOUT_STORAGE_KEY),
      ) ?? DEFAULT_SIGNAL_FEED_LAYOUT
    );
  } catch {
    return DEFAULT_SIGNAL_FEED_LAYOUT;
  }
}

export function writeStoredSignalFeedLayout(layout: SignalFeedLayout): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIGNAL_FEED_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // ignore quota / privacy mode
  }
}
