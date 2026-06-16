/**
 * Full view screen-share layout (§3.4.4.3 voice-video-call-implementation-spec).
 * @public
 */
export type CallFullViewLayoutMode = 'filmstrip' | 'sideBySide' | 'speakerTop';

export const CALL_FULL_VIEW_LAYOUT_MODE_LS_KEY = 'hypha.callFullViewLayoutMode';

const MODES: CallFullViewLayoutMode[] = [
  'filmstrip',
  'sideBySide',
  'speakerTop',
];

export const DEFAULT_CALL_FULL_VIEW_LAYOUT: CallFullViewLayoutMode =
  'sideBySide';

export function parseCallFullViewLayoutMode(
  raw: string | null,
): CallFullViewLayoutMode {
  if (raw === 'pip') {
    return DEFAULT_CALL_FULL_VIEW_LAYOUT;
  }
  if (raw && MODES.includes(raw as CallFullViewLayoutMode)) {
    return raw as CallFullViewLayoutMode;
  }
  return DEFAULT_CALL_FULL_VIEW_LAYOUT;
}

export function readCallFullViewLayoutFromStorage(): CallFullViewLayoutMode {
  if (typeof window === 'undefined') {
    return DEFAULT_CALL_FULL_VIEW_LAYOUT;
  }
  try {
    return parseCallFullViewLayoutMode(
      window.localStorage.getItem(CALL_FULL_VIEW_LAYOUT_MODE_LS_KEY),
    );
  } catch {
    return DEFAULT_CALL_FULL_VIEW_LAYOUT;
  }
}

export function persistCallFullViewLayout(mode: CallFullViewLayoutMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CALL_FULL_VIEW_LAYOUT_MODE_LS_KEY, mode);
  } catch {
    /* private mode, quota */
  }
}
