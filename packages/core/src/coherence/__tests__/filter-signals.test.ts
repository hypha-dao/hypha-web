import { describe, expect, it } from 'vitest';
import {
  filterSignals,
  hasActiveSignalFilters,
  type FilterableSignal,
} from '../filter-signals';
import {
  parseSignalBoardFilters,
  writeSignalBoardFilters,
} from '../signal-filter-query';

const friday = '2026-10-09';
const thursday = new Date('2026-10-08T12:00:00');
const saturday = new Date('2026-10-10T12:00:00');

const cards: FilterableSignal[] = [
  {
    title: 'Draft the memorandum',
    assigneeIds: [7],
    dueAt: thursday,
    tags: ['Memorandum'],
  },
  {
    title: 'Budget review',
    assigneeIds: [7],
    dueAt: saturday,
    tags: ['memorandum'],
  },
  {
    title: 'Unassigned brief',
    assigneeIds: [],
    dueAt: null,
    tags: ['brief'],
  },
  {
    title: 'Overdue memo',
    assigneeIds: [3],
    dueAt: new Date('2026-10-01T12:00:00'),
    tags: ['Memorandum'],
  },
];

describe('filterSignals', () => {
  it('matches the design case: assigned to me, deadline before Friday, tagged memorandum', () => {
    const result = filterSignals(
      cards,
      {
        assignee: 'me',
        deadline: { mode: 'before', date: friday },
        tags: ['memorandum'],
      },
      { currentPersonId: 7, now: new Date('2026-10-06T09:00:00') },
    );
    expect(result).toEqual([cards[0]]);
  });

  it('matches title anywhere, case ignored', () => {
    expect(
      filterSignals(cards, { title: 'MEMO' }).map((card) => card.title),
    ).toEqual(['Draft the memorandum', 'Overdue memo']);
  });

  it('filters by a specific assignee id', () => {
    expect(filterSignals(cards, { assignee: 3 })).toEqual([cards[3]]);
  });

  it('filters overdue and no-deadline cards', () => {
    const now = new Date('2026-10-06T09:00:00');
    expect(
      filterSignals(cards, { deadline: { mode: 'overdue' } }, { now }),
    ).toEqual([cards[3]]);
    expect(filterSignals(cards, { deadline: { mode: 'none' } })).toEqual([
      cards[2],
    ]);
  });

  it('filters after / between dates', () => {
    expect(
      filterSignals(cards, { deadline: { mode: 'after', date: friday } }),
    ).toEqual([cards[1]]);
    expect(
      filterSignals(cards, {
        deadline: { mode: 'between', from: '2026-10-08', to: '2026-10-10' },
      }),
    ).toEqual([cards[0], cards[1]]);
  });

  it('applies tag AND semantics', () => {
    const withTwoTags: FilterableSignal[] = [
      { title: 'A', tags: ['memorandum', 'brief'] },
      { title: 'B', tags: ['memorandum'] },
    ];
    expect(
      filterSignals(withTwoTags, { tags: ['memorandum', 'brief'] }).map(
        (card) => card.title,
      ),
    ).toEqual(['A']);
  });
});

describe('signal filter query', () => {
  it('round-trips a specific assignee id through the URL', () => {
    const written = writeSignalBoardFilters('', { assignee: 42 });
    expect(written.get('assignee')).toBe('42');
    expect(parseSignalBoardFilters(written)).toEqual({ assignee: 42 });
  });

  it('round-trips the design-case filters through the URL', () => {
    const written = writeSignalBoardFilters('', {
      assignee: 'me',
      deadline: { mode: 'before', date: friday },
      tags: ['memorandum'],
    });
    expect(written.get('assignee')).toBe('me');
    expect(written.get('deadline')).toBe('before');
    expect(written.get('deadlineTo')).toBe(friday);
    expect(written.get('tags')).toBe('memorandum');
    expect(parseSignalBoardFilters(written)).toEqual({
      assignee: 'me',
      deadline: { mode: 'before', date: friday },
      tags: ['memorandum'],
    });
  });

  it('reports when any filter is active', () => {
    expect(hasActiveSignalFilters({})).toBe(false);
    expect(hasActiveSignalFilters({ title: 'memo' })).toBe(true);
  });

  it('keeps an incomplete deadline mode in the URL so the date picker stays open', () => {
    const written = writeSignalBoardFilters('', {
      deadline: { mode: 'before' },
    });
    expect(written.get('deadline')).toBe('before');
    expect(written.get('deadlineTo')).toBeNull();
    expect(parseSignalBoardFilters(written)).toEqual({
      deadline: { mode: 'before' },
    });
    expect(
      filterSignals(cards, { deadline: { mode: 'before' } }).map(
        (card) => card.title,
      ),
    ).toEqual(cards.map((card) => card.title));
  });
});
