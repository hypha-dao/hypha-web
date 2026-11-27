import { describe, expect, it } from 'vitest';
import type {
  QuestRecord,
  SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import {
  groupQuestsByColumn,
  groupQuestsByLane,
  questDomainDotClass,
} from '../quest-board-groups';

function quest(
  partial: Partial<QuestRecord> & Pick<QuestRecord, 'slug' | 'name' | 'status'>,
): QuestRecord {
  return {
    id: 1,
    spaceId: 1,
    spaceSlug: 'sandbox',
    spaceTitle: 'Sandbox',
    goal: '',
    scopeIn: [],
    scopeOut: [],
    scopeInMarkdown: '',
    scopeOutMarkdown: '',
    successCriteria: '',
    rewards: [],
    targetDate: null,
    leadPersonId: null,
    leadName: '',
    leadAvatarUrl: null,
    creatorPersonId: null,
    origin: { kind: 'app', clientLabel: null },
    proposalDocumentId: null,
    proposalSlug: null,
    proposalWeb3Id: null,
    proposalStatus: null,
    acceptedAt: null,
    chatRoomId: null,
    health: {
      state: 'on_track',
      marker: 0,
      summary: '',
      updatesThisWeek: 0,
      lastUpdateAt: null,
      generatedAt: null,
      daysToTarget: null,
    },
    stewardHealthSummaries: false,
    memberUpdateAlerts: false,
    deliverablesEnabled: false,
    milestones: [],
    members: [],
    deliverables: [],
    updates: [],
    latestUpdateLine: null,
    latestUpdateAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...partial,
  };
}

const workflow: SignalWorkflowConfig = {
  statuses: [],
  boards: [
    { slug: 'general', name: 'General', color: 'neutral', position: 0 },
    { slug: 'product', name: 'Product', color: 'accent', position: 1 },
    {
      slug: 'old',
      name: 'Old',
      color: 'error',
      position: 2,
      archived: true,
    },
  ],
};

describe('quest board groups', () => {
  it('puts a rejected proposal in the rejected column', () => {
    const columns = groupQuestsByColumn([
      quest({ slug: 'voting', name: 'Voting', status: 'proposed' }),
      quest({
        slug: 'down',
        name: 'Down',
        status: 'proposed',
        proposalStatus: 'rejected',
      }),
      quest({ slug: 'gone', name: 'Gone', status: 'archived' }),
    ]);

    expect(columns.proposed.map((item) => item.slug)).toEqual(['voting']);
    expect(columns.rejected.map((item) => item.slug)).toEqual(['down']);
    expect(columns.active).toEqual([]);
  });

  it('lanes quests by domain and sends a missing domain to the default board', () => {
    const lanes = groupQuestsByLane(
      [
        quest({ slug: 'plain', name: 'Plain', status: 'active' }),
        quest({
          slug: 'built',
          name: 'Built',
          status: 'active',
          domain: 'product',
        }),
        quest({
          slug: 'retired',
          name: 'Retired',
          status: 'paused',
          domain: 'old',
        }),
      ],
      workflow,
    );

    expect(lanes.map((lane) => lane.domain.slug)).toEqual([
      'general',
      'product',
    ]);
    expect(lanes[0]?.columns.active.map((item) => item.slug)).toEqual([
      'plain',
    ]);
    expect(lanes[0]?.columns.paused.map((item) => item.slug)).toEqual([
      'retired',
    ]);
    expect(lanes[1]?.columns.active.map((item) => item.slug)).toEqual([
      'built',
    ]);
  });

  it('maps domain colors to the existing color tokens', () => {
    expect(questDomainDotClass('accent')).toBe('bg-accent-9');
    expect(questDomainDotClass('warn')).toBe('bg-warning-9');
    expect(questDomainDotClass('success')).toBe('bg-success-9');
    expect(questDomainDotClass('error')).toBe('bg-error-9');
    expect(questDomainDotClass('neutral')).toBe('bg-neutral-9');
    expect(questDomainDotClass(null)).toBe('bg-neutral-9');
  });
});
