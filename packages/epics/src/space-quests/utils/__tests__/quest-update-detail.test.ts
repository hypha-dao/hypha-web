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

  it('shows small fields as from X to Y', () => {
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
        line: 'Title: from Old title to New title',
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
            label: 'Order',
            format: 'short',
            action: 'reordered',
            before: 'M1 Draft, M2 Review',
            after: 'M1 Review, M2 Draft',
          },
        ],
      }).map((entry) => (entry.kind === 'short' ? entry.line : entry.label)),
    ).toEqual([
      'Added Milestone: Ship',
      'Reordered from M1 Draft, M2 Review to M1 Review, M2 Draft',
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
