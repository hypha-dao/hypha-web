import type { SignalViewMode } from '../components/signal-section';

export const SIGNAL_VIEW_QUERY_KEY = 'view';

export const DEFAULT_SIGNAL_VIEW_MODE = 'list' satisfies SignalViewMode;

export const SIGNAL_VIEW_MODES = [
  'grid',
  'board',
  'swimlane',
  'list',
] as const satisfies readonly SignalViewMode[];

const SIGNAL_VIEW_STORAGE_KEY_PREFIX = 'hypha.signalView.';

export function parseSignalViewMode(
  raw: string | null | undefined,
): SignalViewMode | null {
  if (!raw) return null;
  return (SIGNAL_VIEW_MODES as readonly string[]).includes(raw)
    ? (raw as SignalViewMode)
    : null;
}

export function isDefaultSignalViewMode(view: SignalViewMode): boolean {
  return view === DEFAULT_SIGNAL_VIEW_MODE;
}

export function readStoredSignalViewMode(
  spaceSlug: string,
): SignalViewMode | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return parseSignalViewMode(
      localStorage.getItem(`${SIGNAL_VIEW_STORAGE_KEY_PREFIX}${spaceSlug}`),
    );
  } catch {
    return null;
  }
}

export function writeStoredSignalViewMode(
  spaceSlug: string,
  view: SignalViewMode,
): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(`${SIGNAL_VIEW_STORAGE_KEY_PREFIX}${spaceSlug}`, view);
  } catch {
    // ignore quota / privacy mode
  }
}
