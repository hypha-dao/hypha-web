import { describe, expect, it } from 'vitest';
import {
  QUEST_OFF_TRACK_MARKER,
  QUEST_ON_TRACK_MARKER,
  computeQuestHealth,
  questHealthDisplay,
} from '../health-display';

const now = new Date(2026, 10, 9, 15, 0, 0);
const today = '2026-11-09';
const yesterday = '2026-11-08';
const tomorrow = '2026-11-10';

function milestone(
  status: 'not_started' | 'in_progress' | 'done',
  dueDate: string | null,
) {
  return { status, dueDate };
}

describe('computeQuestHealth', () => {
  it('is off track when an incomplete milestone target date is past', () => {
    expect(
      computeQuestHealth(
        {
          status: 'active',
          targetDate: tomorrow,
          milestones: [
            milestone('done', yesterday),
            milestone('in_progress', yesterday),
          ],
        },
        now,
      ),
    ).toEqual({ state: 'off_track', marker: QUEST_OFF_TRACK_MARKER });
  });

  it('is off track when an incomplete milestone has no target date', () => {
    expect(
      computeQuestHealth(
        {
          status: 'active',
          targetDate: tomorrow,
          milestones: [milestone('not_started', null)],
        },
        now,
      ).state,
    ).toBe('off_track');
    expect(
      computeQuestHealth(
        {
          status: 'active',
          targetDate: tomorrow,
          milestones: [milestone('in_progress', '   ')],
        },
        now,
      ).state,
    ).toBe('off_track');
  });

  it('is off track when the quest target date is past and the quest is not completed', () => {
    expect(
      computeQuestHealth(
        {
          status: 'active',
          targetDate: yesterday,
          milestones: [milestone('not_started', tomorrow)],
        },
        now,
      ),
    ).toEqual({ state: 'off_track', marker: QUEST_OFF_TRACK_MARKER });
    expect(
      computeQuestHealth(
        {
          status: 'completed',
          targetDate: yesterday,
          milestones: [milestone('done', yesterday)],
        },
        now,
      ).state,
    ).toBe('on_track');
  });

  it('is on track when today is not past an incomplete milestone or the quest', () => {
    expect(
      computeQuestHealth(
        {
          status: 'active',
          targetDate: today,
          milestones: [milestone('not_started', today)],
        },
        now,
      ),
    ).toEqual({ state: 'on_track', marker: QUEST_ON_TRACK_MARKER });
    expect(QUEST_ON_TRACK_MARKER).toBeGreaterThan(0);
  });

  it('ignores completed milestones, including undated and past ones', () => {
    expect(
      computeQuestHealth(
        {
          status: 'active',
          targetDate: tomorrow,
          milestones: [
            milestone('done', null),
            milestone('done', yesterday),
            milestone('not_started', tomorrow),
          ],
        },
        now,
      ).state,
    ).toBe('on_track');
  });

  it('judges a quest with no target date by milestones only', () => {
    expect(
      computeQuestHealth(
        {
          status: 'active',
          targetDate: null,
          milestones: [milestone('not_started', tomorrow)],
        },
        now,
      ).state,
    ).toBe('on_track');
    expect(
      computeQuestHealth(
        {
          status: 'active',
          targetDate: '   ',
          milestones: [milestone('not_started', yesterday)],
        },
        now,
      ).state,
    ).toBe('off_track');
  });

  it('is on track with no milestones, and off track when only the quest date is past', () => {
    expect(
      computeQuestHealth(
        { status: 'active', targetDate: null, milestones: [] },
        now,
      ),
    ).toEqual({ state: 'on_track', marker: QUEST_ON_TRACK_MARKER });
    expect(
      computeQuestHealth(
        { status: 'active', targetDate: tomorrow, milestones: [] },
        now,
      ).state,
    ).toBe('on_track');
    expect(
      computeQuestHealth(
        { status: 'active', targetDate: yesterday, milestones: [] },
        now,
      ).state,
    ).toBe('off_track');
  });

  it('is on track when every milestone is completed and the quest date is still ahead', () => {
    expect(
      computeQuestHealth(
        {
          status: 'active',
          targetDate: null,
          milestones: [milestone('done', null), milestone('done', yesterday)],
        },
        now,
      ).state,
    ).toBe('on_track');
    expect(
      computeQuestHealth(
        {
          status: 'active',
          targetDate: today,
          milestones: [milestone('done', yesterday)],
        },
        now,
      ).state,
    ).toBe('on_track');
  });
});

describe('questHealthDisplay active rule', () => {
  const stored = {
    state: 'on_track' as const,
    marker: 0,
    summary:
      'No updates posted yet. Post progress updates to keep Quest health current.',
  };

  it('shows on track in the green marker instead of the stored start position', () => {
    expect(
      questHealthDisplay(
        {
          status: 'active',
          targetDate: tomorrow,
          milestones: [milestone('not_started', tomorrow)],
          health: stored,
        },
        now,
      ),
    ).toEqual({
      notStarted: false,
      label: 'On track',
      marker: QUEST_ON_TRACK_MARKER,
      summary: null,
      state: 'on_track',
    });
  });

  it('shows off track on the red marker when a milestone date is missing', () => {
    expect(
      questHealthDisplay(
        {
          status: 'active',
          targetDate: tomorrow,
          milestones: [milestone('not_started', null)],
          health: stored,
        },
        now,
      ),
    ).toMatchObject({
      label: 'Off track',
      marker: QUEST_OFF_TRACK_MARKER,
      state: 'off_track',
    });
  });

  it('keeps proposed, paused, and completed on their current display', () => {
    expect(
      questHealthDisplay(
        {
          status: 'proposed',
          targetDate: yesterday,
          milestones: [milestone('not_started', null)],
          health: { state: 'on_track', marker: 80, summary: '' },
        },
        now,
      ),
    ).toMatchObject({ label: 'Not started', marker: 0, state: null });
    expect(
      questHealthDisplay(
        {
          status: 'paused',
          targetDate: yesterday,
          milestones: [milestone('not_started', null)],
          health: { state: 'at_risk', marker: 45, summary: 'Waiting' },
        },
        now,
      ),
    ).toMatchObject({ label: 'At risk', marker: 45, state: 'at_risk' });
    expect(
      questHealthDisplay(
        {
          status: 'completed',
          targetDate: yesterday,
          milestones: [milestone('not_started', null)],
          health: { state: 'off_track', marker: 12, summary: 'Shipped' },
        },
        now,
      ),
    ).toMatchObject({
      label: 'Off track',
      marker: 100,
      state: 'off_track',
      summary: 'Shipped',
    });
  });
});
