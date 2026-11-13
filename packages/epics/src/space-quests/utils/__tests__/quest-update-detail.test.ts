import { describe, expect, it } from 'vitest';
import {
  questUpdateDetailEntries,
  questUpdateDetailIsLong,
} from '../quest-update-detail';

describe('quest update detail', () => {
  it('shows text sections as before and after without escape slashes', () => {
    const entries = questUpdateDetailEntries({
      entity: 'quest',
      field: 'goal',
      action: 'updated',
      format: 'text',
      before: 'Keep \\[QA\\]',
      after: 'Ship \\[QA\\] now',
    });
    expect(entries).toEqual([
      {
        kind: 'text',
        label: 'Goal',
        before: 'Keep [QA]',
        after: 'Ship [QA] now',
      },
    ]);
  });

  it('shows small fields as a single before to after line', () => {
    expect(
      questUpdateDetailEntries({
        entity: 'quest',
        field: 'name',
        action: 'updated',
        before: 'Old title',
        after: 'New title',
      }),
    ).toEqual([
      {
        kind: 'short',
        label: 'Title',
        before: 'Old title',
        after: 'New title',
      },
    ]);
    expect(
      questUpdateDetailEntries({
        entity: 'milestone',
        field: 'milestones',
        action: 'updated',
        items: [
          {
            label: 'Milestone',
            format: 'short',
            action: 'added',
            before: null,
            after: 'Ship',
          },
          {
            label: 'Milestone',
            format: 'short',
            action: 'removed',
            before: 'Archive',
            after: null,
          },
          {
            label: 'Order',
            format: 'short',
            action: 'reordered',
            before: 'M1 Draft, M2 Review',
            after: 'M1 Review, M2 Draft',
          },
        ],
      }),
    ).toEqual([
      {
        kind: 'list',
        label: 'Milestones',
        rows: [
          { kind: 'added', text: 'Ship', label: 'Milestone' },
          { kind: 'removed', text: 'Archive', label: 'Milestone' },
        ],
      },
      {
        kind: 'short',
        label: 'Order',
        before: 'M1 Draft, M2 Review',
        after: 'M1 Review, M2 Draft',
      },
    ]);
  });

  it('diffs bullet lists instead of repeating both texts', () => {
    expect(
      questUpdateDetailEntries({
        entity: 'quest',
        field: 'scope',
        action: 'updated',
        format: 'text',
        before: 'In:\n- Keep\n- Ship\n\nOut:\n- Pause',
        after: 'In:\n- Keep\n- Launch\n\nOut:\n- Pause\n- Archive',
      }),
    ).toEqual([
      {
        kind: 'list',
        label: 'Scope',
        rows: [
          { kind: 'changed', before: 'Ship', after: 'Launch', label: 'In' },
          { kind: 'added', text: 'Archive', label: 'Out' },
        ],
      },
    ]);
  });

  it('falls back when an older update stored no change data', () => {
    expect(questUpdateDetailEntries(null)).toEqual([]);
    expect(
      questUpdateDetailEntries({
        entity: 'quest',
        field: 'scope',
        action: 'updated',
      }),
    ).toEqual([]);
    expect(
      questUpdateDetailEntries({
        entity: 'quest',
        field: 'goal',
        action: 'updated',
        before: 'Same',
        after: 'Same',
      }),
    ).toEqual([]);
  });

  it('marks long text for collapse', () => {
    const long = 'a'.repeat(241);
    const entries = questUpdateDetailEntries({
      entity: 'quest',
      field: 'successCriteria',
      action: 'updated',
      format: 'text',
      before: 'Short',
      after: long,
    });
    expect(questUpdateDetailIsLong(entries)).toBe(true);
  });
});
