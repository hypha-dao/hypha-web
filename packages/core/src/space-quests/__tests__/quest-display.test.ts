import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatQuestCalendarDate } from '../calendar-date';
import {
  buildMilestoneStatusPatch,
  canChangeMilestoneStatus,
  milestoneEditorChrome,
  questHtmlHasVisibleText,
  questOverviewVisibility,
} from '../detail-sections';
import { NEW_QUEST_HEALTH_RECORD, questHealthDisplay } from '../health-display';
import type { QuestMemberRecord } from '../types';

function member(partial: Partial<QuestMemberRecord>): QuestMemberRecord {
  return {
    id: 1,
    questId: 1,
    personId: 2,
    memberName: 'Grace Hopper',
    memberAvatarUrl: null,
    roleLabel: 'Member',
    responsibilities: [],
    order: 1,
    ...partial,
  };
}

const baseQuest = {
  leadPersonId: 1,
  leadName: 'Ada Lovelace',
  members: [member({ personId: 2 })],
};

describe('formatQuestCalendarDate', () => {
  it('formats an ISO date as day, full English month, and year', () => {
    expect(formatQuestCalendarDate('2026-11-20')).toBe('20 November 2026');
    expect(formatQuestCalendarDate('2026-11-20T00:00:00.000Z')).toBe(
      '20 November 2026',
    );
    expect(formatQuestCalendarDate('  20 Nov 2026 ')).toBe('20 November 2026');
    expect(formatQuestCalendarDate('20th November 2026', 'en-US')).toBe(
      '20 November 2026',
    );
  });

  it('keeps the calendar day for other locales and leaves unknown text unchanged', () => {
    const portuguese = formatQuestCalendarDate('2026-11-20', 'pt');
    expect(portuguese).toContain('20');
    expect(portuguese).toContain('2026');
    expect(portuguese.toLowerCase()).toContain('novembro');
    expect(portuguese).not.toContain('19');
    expect(formatQuestCalendarDate('next quarter')).toBe('next quarter');
    expect(formatQuestCalendarDate('2026-02-31')).toBe('2026-02-31');
    expect(formatQuestCalendarDate(null)).toBe('');
  });
});

describe('questHealthDisplay', () => {
  const stored = {
    state: 'on_track' as const,
    marker: 82,
    summary: 'Quest proposal submitted for voting.',
  };

  it('maps proposed quests to the start of the bar without the voting sentence', () => {
    expect(questHealthDisplay({ status: 'proposed', health: stored })).toEqual({
      notStarted: true,
      label: 'Not started',
      marker: 0,
      summary: null,
      state: null,
    });
  });

  it('keeps paused, completed, and active health and drops only the voting sentence', () => {
    expect(
      questHealthDisplay({
        status: 'paused',
        health: { state: 'at_risk', marker: 45, summary: 'Waiting on review' },
      }),
    ).toMatchObject({
      notStarted: false,
      label: 'At risk',
      marker: 45,
      summary: 'Waiting on review',
      state: 'at_risk',
    });
    expect(
      questHealthDisplay({
        status: 'completed',
        health: { state: 'on_track', marker: 100, summary: 'Shipped' },
      }),
    ).toMatchObject({ label: 'On track', marker: 100, state: 'on_track' });
    expect(
      questHealthDisplay({
        status: 'active',
        health: stored,
      }),
    ).toMatchObject({
      notStarted: false,
      label: 'On track',
      marker: 82,
      summary: null,
      state: 'on_track',
    });
    expect(
      questHealthDisplay({
        status: 'archived',
        health: { state: 'off_track', marker: 12, summary: 'Stopped' },
      }),
    ).toMatchObject({ label: 'Off track', marker: 12, summary: 'Stopped' });
  });

  it('stores a new quest at the start with an empty summary', () => {
    expect(NEW_QUEST_HEALTH_RECORD).toEqual({
      healthState: 'on_track',
      healthMarker: 0,
      healthSummary: '',
    });
    const source = readFileSync(
      new URL('../server/mutations.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('NEW_QUEST_HEALTH_RECORD.healthMarker');
    expect(source).toContain('NEW_QUEST_HEALTH_RECORD.healthSummary');
    expect(source).not.toContain('Quest proposal submitted for voting');
  });
});

describe('questOverviewVisibility', () => {
  const empty = {
    status: 'active' as const,
    goal: '',
    scopeIn: [],
    scopeOut: [],
    scopeInMarkdown: '<p></p>',
    scopeOutMarkdown: '   ',
    successCriteria: '<p><br></p>',
    rewards: [],
    milestones: [],
    members: [],
    deliverables: [],
  };

  it('hides empty optional sections and keeps health', () => {
    expect(questOverviewVisibility(empty)).toEqual({
      showGoal: false,
      showScopeIn: false,
      showScopeOut: false,
      showSuccess: false,
      showScopeCard: false,
      showRewards: false,
      showMilestones: false,
      showMembers: false,
      showDeliverables: false,
      showHealth: true,
      showTargetDate: false,
    });
  });

  it('shows defined content and hides deliverables while proposed', () => {
    expect(
      questOverviewVisibility({
        ...empty,
        status: 'proposed',
        goal: 'Ship the checklist',
        scopeIn: ['Sandbox'],
        successCriteria: '60% join',
        rewards: [{ amount: '10', token: 'USDC' }],
        milestones: [{ name: 'Run check' }],
        members: [{ memberName: 'Ada' }],
        deliverables: [{ name: 'Notes' }],
      }),
    ).toMatchObject({
      showGoal: true,
      showScopeIn: true,
      showSuccess: true,
      showScopeCard: true,
      showRewards: true,
      showMilestones: true,
      showMembers: true,
      showDeliverables: false,
    });
    expect(
      questOverviewVisibility({
        ...empty,
        status: 'active',
        deliverables: [{ name: 'Notes' }],
      }).showDeliverables,
    ).toBe(true);
    expect(
      questOverviewVisibility({ ...empty, targetDate: '   ' }).showTargetDate,
    ).toBe(false);
    expect(
      questOverviewVisibility({ ...empty, targetDate: '2026-11-20' })
        .showTargetDate,
    ).toBe(true);
  });

  it('hides empty rich text and keeps malformed or real content', () => {
    expect(questHtmlHasVisibleText(null)).toBe(false);
    expect(questHtmlHasVisibleText(undefined)).toBe(false);
    expect(questHtmlHasVisibleText('')).toBe(false);
    expect(questHtmlHasVisibleText('   \n\t')).toBe(false);
    expect(questHtmlHasVisibleText('<p></p>')).toBe(false);
    expect(questHtmlHasVisibleText('<p><br></p>')).toBe(false);
    expect(questHtmlHasVisibleText('<p><br/></p>')).toBe(false);
    expect(questHtmlHasVisibleText('<>')).toBe(false);
    expect(questHtmlHasVisibleText('<p>Ship the checklist</p>')).toBe(true);
    expect(questHtmlHasVisibleText('<p>hello<br>there</p>')).toBe(true);
    expect(questHtmlHasVisibleText('a < b')).toBe(true);
    expect(questHtmlHasVisibleText('<p>text')).toBe(true);
    expect(questHtmlHasVisibleText('<scr<script>ipt>alert(1)')).toBe(true);
    expect(questHtmlHasVisibleText('<p>&nbsp;</p>')).toBe(true);
    expect(
      questHtmlHasVisibleText('![diagram](https://example.com/a.png)'),
    ).toBe(true);

    expect(
      questOverviewVisibility({
        ...empty,
        goal: '<p></p>',
        scopeInMarkdown: '<p><br></p>',
        scopeOutMarkdown: '<p>&nbsp;</p>',
        successCriteria: '<p>60% of new members join</p>',
      }),
    ).toMatchObject({
      showGoal: false,
      showScopeIn: false,
      showScopeOut: false,
      showSuccess: true,
      showScopeCard: true,
    });
    expect(
      questOverviewVisibility({
        ...empty,
        goal: '[the checklist](https://example.com/checks)',
        successCriteria: 'https://example.com/result',
      }),
    ).toMatchObject({ showGoal: true, showSuccess: true });
    expect(
      questOverviewVisibility({
        ...empty,
        goal: '![diagram](https://example.com/a.png)',
      }).showGoal,
    ).toBe(false);

    const hostile = '<'.repeat(100_000);
    const started = Date.now();
    expect(questHtmlHasVisibleText(hostile)).toBe(true);
    expect(
      questOverviewVisibility({
        ...empty,
        goal: hostile,
        successCriteria: `<p>${'<'.repeat(20_000)}</p><p>kept</p>`,
      }),
    ).toMatchObject({ showGoal: true, showSuccess: true });
    expect(Date.now() - started).toBeLessThan(200);
  });
});

describe('milestone editor chrome', () => {
  it('uses Add milestone only when the list is empty', () => {
    expect(milestoneEditorChrome(0)).toEqual({
      addLabel: 'Add milestone',
      showInsertHint: false,
    });
    expect(milestoneEditorChrome(2)).toEqual({
      addLabel: 'Add milestone at end',
      showInsertHint: true,
    });
  });
});

describe('milestone status changes', () => {
  const milestones = [
    {
      id: 10,
      name: 'Run check',
      description: 'Checklist',
      dueDate: '2026-11-20',
      ownerPersonId: 2,
      ownerName: 'Grace Hopper',
      status: 'not_started' as const,
    },
    {
      id: 11,
      name: 'Review',
      description: '',
      dueDate: null,
      ownerPersonId: null,
      ownerName: null,
      status: 'in_progress' as const,
    },
  ];

  it('patches one status and keeps the other milestone fields', () => {
    expect(buildMilestoneStatusPatch(milestones, 10, 'done')).toEqual({
      milestones: [{ ...milestones[0], status: 'done' }, milestones[1]],
    });
    expect(buildMilestoneStatusPatch(milestones, 10, 'not_started')).toBeNull();
    expect(buildMilestoneStatusPatch(milestones, 99, 'done')).toBeNull();
  });

  it('allows active and paused members and refuses everyone else', () => {
    expect(
      canChangeMilestoneStatus(
        { id: 2, name: 'Grace' },
        {
          ...baseQuest,
          status: 'active',
        },
      ),
    ).toBe(true);
    expect(
      canChangeMilestoneStatus(
        { id: 1, name: 'Ada' },
        {
          ...baseQuest,
          status: 'paused',
        },
      ),
    ).toBe(true);
    expect(
      canChangeMilestoneStatus(
        { id: 9, name: 'Outsider' },
        {
          ...baseQuest,
          status: 'active',
        },
      ),
    ).toBe(false);
    expect(
      canChangeMilestoneStatus(
        { id: 1, name: 'Ada' },
        {
          ...baseQuest,
          status: 'proposed',
        },
      ),
    ).toBe(false);
    expect(
      canChangeMilestoneStatus(
        { id: 1, name: 'Ada' },
        {
          ...baseQuest,
          status: 'archived',
        },
      ),
    ).toBe(false);
    expect(
      canChangeMilestoneStatus(null, { ...baseQuest, status: 'active' }),
    ).toBe(false);
  });
});
