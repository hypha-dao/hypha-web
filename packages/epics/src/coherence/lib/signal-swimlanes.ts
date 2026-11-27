import {
  COHERENCE_SIGNAL_TYPES,
  DEFAULT_SIGNAL_WORKFLOW,
  canonicalSignalType,
  resolveEffectiveBoard,
  type Coherence,
  type SignalBoardDefinition,
  type SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import { activeSignalBoards } from './signal-board-label';

/** Signals tab views (#2765). The feed stays the default. */
export const SIGNAL_TAB_VIEWS = ['feed', 'swimlanes'] as const;
export type SignalTabView = (typeof SIGNAL_TAB_VIEWS)[number];
export const DEFAULT_SIGNAL_TAB_VIEW: SignalTabView = 'feed';
export const SIGNAL_TAB_VIEW_QUERY_KEY = 'view';

/**
 * What the swimlane columns split each board by (#2763 D6). Rows are always
 * boards; `none` keeps one column per board.
 */
export const SIGNAL_LANE_COLUMNS = ['none', 'type', 'creator'] as const;
export type SignalLaneColumns = (typeof SIGNAL_LANE_COLUMNS)[number];
export const DEFAULT_SIGNAL_LANE_COLUMNS: SignalLaneColumns = 'none';
export const SIGNAL_LANE_COLUMNS_QUERY_KEY = 'columns';

/** Own prefix: older builds stored `grid` / `board` / `list` under another key. */
const TAB_VIEW_STORAGE_PREFIX = 'hypha.signalTabView.';

export function parseSignalTabView(
  raw: string | null | undefined,
): SignalTabView | null {
  return (SIGNAL_TAB_VIEWS as readonly string[]).includes(raw ?? '')
    ? (raw as SignalTabView)
    : null;
}

export function parseSignalLaneColumns(
  raw: string | null | undefined,
): SignalLaneColumns {
  return (SIGNAL_LANE_COLUMNS as readonly string[]).includes(raw ?? '')
    ? (raw as SignalLaneColumns)
    : DEFAULT_SIGNAL_LANE_COLUMNS;
}

export function readStoredSignalTabView(
  spaceSlug: string,
): SignalTabView | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseSignalTabView(
      window.localStorage.getItem(`${TAB_VIEW_STORAGE_PREFIX}${spaceSlug}`),
    );
  } catch {
    return null;
  }
}

export function writeStoredSignalTabView(
  spaceSlug: string,
  view: SignalTabView,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${TAB_VIEW_STORAGE_PREFIX}${spaceSlug}`, view);
  } catch {
    // Private mode or quota: the URL still carries the view.
  }
}

/** Column key for signals whose creator is not known. */
export const UNKNOWN_CREATOR_COLUMN = 'unknown';

export type SignalLaneColumn<T> = {
  /** Type name, creator person id, `unknown`, or `all` for no columns. */
  key: string;
  signals: T[];
};

export type SignalLane<T> = {
  board: SignalBoardDefinition;
  count: number;
  columns: SignalLaneColumn<T>[];
};

type LaneSignal = {
  board?: string | null;
  type: string;
  creatorId: number | null;
};

function columnKeyFor(signal: LaneSignal, columns: SignalLaneColumns): string {
  if (columns === 'type') {
    return canonicalSignalType(signal.type) || 'Opportunity';
  }
  if (columns === 'creator') {
    return typeof signal.creatorId === 'number' && signal.creatorId > 0
      ? String(signal.creatorId)
      : UNKNOWN_CREATOR_COLUMN;
  }
  return 'all';
}

/**
 * Column keys shared by every lane, so columns line up across boards.
 * Type columns follow the fixed type order and only list types that occur;
 * creator columns go by number of signals, then person id; unknown is last.
 */
function orderedColumnKeys<T extends LaneSignal>(
  signals: readonly T[],
  columns: SignalLaneColumns,
): string[] {
  if (columns === 'none') return ['all'];
  const counts = new Map<string, number>();
  for (const signal of signals) {
    const key = columnKeyFor(signal, columns);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (columns === 'type') {
    const known = (COHERENCE_SIGNAL_TYPES as readonly string[]).filter((type) =>
      counts.has(type),
    );
    const other = [...counts.keys()]
      .filter((key) => !known.includes(key))
      .sort((a, b) => a.localeCompare(b));
    return [...known, ...other];
  }
  return [...counts.entries()]
    .filter(([key]) => key !== UNKNOWN_CREATOR_COLUMN)
    .sort(([aKey, aCount], [bKey, bCount]) =>
      aCount !== bCount ? bCount - aCount : Number(aKey) - Number(bKey),
    )
    .map(([key]) => key)
    .concat(counts.has(UNKNOWN_CREATOR_COLUMN) ? [UNKNOWN_CREATOR_COLUMN] : []);
}

/**
 * Rows are the space's active boards in position order; each signal sits on
 * its effective board (unset or unknown reads as the default board). Signals
 * keep their incoming order inside a cell, so the feed's sort applies there.
 */
export function groupSignalsIntoLanes<T extends LaneSignal>(
  signals: readonly T[],
  workflow: SignalWorkflowConfig | null | undefined,
  columns: SignalLaneColumns,
): SignalLane<T>[] {
  const config = workflow ?? DEFAULT_SIGNAL_WORKFLOW;
  const boards = activeSignalBoards(config);
  const keys = orderedColumnKeys(signals, columns);
  const lanes = new Map<string, SignalLane<T>>();
  for (const board of boards) {
    lanes.set(board.slug, {
      board,
      count: 0,
      columns: keys.map((key) => ({ key, signals: [] })),
    });
  }
  for (const signal of signals) {
    const lane = lanes.get(resolveEffectiveBoard(signal.board, config));
    if (!lane) continue;
    const key = columnKeyFor(signal, columns);
    const column = lane.columns.find((item) => item.key === key);
    if (!column) continue;
    column.signals.push(signal);
    lane.count += 1;
  }
  return [...lanes.values()];
}

/** Whether dropping the signal on this board changes anything. */
export function isSignalBoardMove(
  signal: Pick<Coherence, 'board'>,
  targetBoard: string,
  workflow: SignalWorkflowConfig | null | undefined,
): boolean {
  const config = workflow ?? DEFAULT_SIGNAL_WORKFLOW;
  return resolveEffectiveBoard(signal.board, config) !== targetBoard;
}
