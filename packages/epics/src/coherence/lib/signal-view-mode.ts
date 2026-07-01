import type { SignalViewMode } from '../components/signal-section';

export const SIGNAL_VIEW_QUERY_KEY = 'view';

export const SIGNAL_VIEW_MODES = [
  'board',
  'swimlane',
  'list',
  'grid',
] as const satisfies readonly SignalViewMode[];

export function parseSignalViewMode(
  raw: string | null | undefined,
): SignalViewMode | null {
  if (!raw) return null;
  return (SIGNAL_VIEW_MODES as readonly string[]).includes(raw)
    ? (raw as SignalViewMode)
    : null;
}

export function isDefaultSignalViewMode(view: SignalViewMode): boolean {
  return view === 'board';
}
