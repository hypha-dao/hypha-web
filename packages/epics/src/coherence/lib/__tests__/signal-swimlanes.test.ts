import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGNAL_WORKFLOW,
  type SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import {
  UNKNOWN_CREATOR_COLUMN,
  groupSignalsIntoLanes,
  isSignalBoardMove,
  parseSignalLaneColumns,
  parseSignalTabView,
} from '../signal-swimlanes';

const workflow: SignalWorkflowConfig = {
  ...DEFAULT_SIGNAL_WORKFLOW,
  boards: [
    { slug: 'general', name: 'General', color: 'neutral', position: 0 },
    { slug: 'energy', name: 'Energy', color: 'accent', position: 1 },
    {
      slug: 'old',
      name: 'Old',
      color: 'neutral',
      position: 2,
      archived: true,
    },
  ],
};

type Row = {
  id: number;
  board: string | null;
  type: string;
  creatorId: number | null;
};

const row = (
  id: number,
  board: string | null,
  type: string,
  creatorId: number | null = 1,
): Row => ({ id, board, type, creatorId });

const ids = (signals: Row[]) => signals.map((signal) => signal.id);

describe('parse helpers', () => {
  it('reads known views and ignores the old view names', () => {
    expect(parseSignalTabView('swimlanes')).toBe('swimlanes');
    expect(parseSignalTabView('feed')).toBe('feed');
    expect(parseSignalTabView('grid')).toBeNull();
    expect(parseSignalTabView(null)).toBeNull();
  });

  it('falls back to no columns', () => {
    expect(parseSignalLaneColumns('type')).toBe('type');
    expect(parseSignalLaneColumns('creator')).toBe('creator');
    expect(parseSignalLaneColumns('members')).toBe('none');
    expect(parseSignalLaneColumns(undefined)).toBe('none');
  });
});

describe('groupSignalsIntoLanes', () => {
  const signals = [
    row(1, 'energy', 'Risk', 7),
    row(2, null, 'Need', 7),
    row(3, 'old', 'Risk', 9),
    row(4, 'missing', 'Insight', null),
    row(5, 'energy', 'Need', 9),
  ];

  it('has one row per active board, in position order', () => {
    const lanes = groupSignalsIntoLanes(signals, workflow, 'none');
    expect(lanes.map((lane) => lane.board.slug)).toEqual(['general', 'energy']);
  });

  it('puts unset, unknown and archived boards on the default board', () => {
    const [general, energy] = groupSignalsIntoLanes(signals, workflow, 'none');
    expect(ids(general!.columns[0]!.signals)).toEqual([2, 3, 4]);
    expect(ids(energy!.columns[0]!.signals)).toEqual([1, 5]);
    expect(general!.count).toBe(3);
    expect(energy!.count).toBe(2);
  });

  it('keeps the incoming order inside a cell', () => {
    const reversed = [...signals].reverse();
    const [general] = groupSignalsIntoLanes(reversed, workflow, 'none');
    expect(ids(general!.columns[0]!.signals)).toEqual([4, 3, 2]);
  });

  it('splits by type in the fixed type order, same columns on every lane', () => {
    const lanes = groupSignalsIntoLanes(signals, workflow, 'type');
    for (const lane of lanes) {
      expect(lane.columns.map((column) => column.key)).toEqual([
        'Need',
        'Insight',
        'Risk',
      ]);
    }
    const energy = lanes[1]!;
    expect(ids(energy.columns.find((c) => c.key === 'Risk')!.signals)).toEqual([
      1,
    ]);
    expect(
      ids(energy.columns.find((c) => c.key === 'Insight')!.signals),
    ).toEqual([]);
  });

  it('splits by creator, most signals first, unknown last', () => {
    const lanes = groupSignalsIntoLanes(
      [...signals, row(6, 'energy', 'Need', 9)],
      workflow,
      'creator',
    );
    expect(lanes[0]!.columns.map((column) => column.key)).toEqual([
      '9',
      '7',
      UNKNOWN_CREATOR_COLUMN,
    ]);
    const general = lanes[0]!;
    expect(
      ids(
        general.columns.find((c) => c.key === UNKNOWN_CREATOR_COLUMN)!.signals,
      ),
    ).toEqual([4]);
  });

  it('uses the default workflow before the space workflow loads', () => {
    const lanes = groupSignalsIntoLanes(signals, null, 'none');
    expect(lanes).toHaveLength(1);
    expect(lanes[0]!.count).toBe(signals.length);
  });
});

describe('isSignalBoardMove', () => {
  it('is false for the board the signal already sits on', () => {
    expect(isSignalBoardMove({ board: 'energy' }, 'energy', workflow)).toBe(
      false,
    );
    expect(isSignalBoardMove({ board: null }, 'general', workflow)).toBe(false);
  });

  it('is true for another board', () => {
    expect(isSignalBoardMove({ board: null }, 'energy', workflow)).toBe(true);
  });
});
