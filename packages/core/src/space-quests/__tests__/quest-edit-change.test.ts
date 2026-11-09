import { describe, expect, it } from 'vitest';
import {
  questDeliverableChange,
  questGoalChange,
  questMemberChange,
  questMilestoneChange,
  questNameChange,
  questRewardChange,
  questScopeChangeText,
  questStatusChange,
  questSuccessChange,
  questTargetDateChange,
} from '../quest-edit-change';
import type {
  QuestDeliverableRecord,
  QuestMemberRecord,
  QuestMilestoneRecord,
} from '../types';

function milestone(
  partial: Partial<QuestMilestoneRecord> &
    Pick<QuestMilestoneRecord, 'id' | 'name'>,
): QuestMilestoneRecord {
  return {
    questId: 1,
    order: partial.id,
    description: '',
    dueDate: null,
    ownerPersonId: null,
    ownerName: null,
    status: 'not_started',
    ...partial,
  };
}

function member(
  partial: Partial<QuestMemberRecord> &
    Pick<QuestMemberRecord, 'id' | 'memberName'>,
): QuestMemberRecord {
  return {
    questId: 1,
    personId: partial.id,
    memberAvatarUrl: null,
    roleLabel: null,
    responsibilities: [],
    order: partial.id,
    ...partial,
  };
}

function deliverable(
  partial: Partial<QuestDeliverableRecord> &
    Pick<QuestDeliverableRecord, 'id' | 'name'>,
): QuestDeliverableRecord {
  return {
    questId: 1,
    url: null,
    note: null,
    order: partial.id,
    updatedByPersonId: null,
    updatedByName: null,
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...partial,
  };
}

describe('quest edit change payloads', () => {
  it('stores goal, scope, and success text before and after', () => {
    expect(questGoalChange('Ship it', 'Ship the checklist')).toMatchObject({
      field: 'goal',
      format: 'text',
      before: 'Ship it',
      after: 'Ship the checklist',
    });
    expect(
      questScopeChangeText({
        scopeInMarkdown: 'In scope',
        scopeOutMarkdown: '',
        scopeOut: ['Ads'],
      }),
    ).toBe('In:\nIn scope\n\nOut:\n- Ads');
    expect(questSuccessChange('Old', 'New')).toMatchObject({
      field: 'successCriteria',
      format: 'text',
      before: 'Old',
      after: 'New',
    });
  });

  it('stores short from-to values for title, status, date, and reward', () => {
    expect(questNameChange('Old title', 'New title')).toMatchObject({
      field: 'name',
      format: 'short',
      before: 'Old title',
      after: 'New title',
    });
    expect(questStatusChange('active', 'paused')).toMatchObject({
      before: 'active',
      after: 'paused',
    });
    expect(questTargetDateChange(null, '2026-12-01')).toMatchObject({
      before: null,
      after: '2026-12-01',
    });
    expect(
      questRewardChange(
        [{ amount: '10', token: 'USDC' }],
        [{ amount: '20', token: 'USDC' }],
      ),
    ).toMatchObject({
      field: 'rewards',
      format: 'short',
      before: '10 USDC',
      after: '20 USDC',
    });
  });

  it('keeps one milestone change and records reorder, add, remove, and description', () => {
    const before = [
      milestone({ id: 1, name: 'Draft', description: 'Notes' }),
      milestone({ id: 2, name: 'Review', description: '' }),
    ];
    const reordered = questMilestoneChange(before, [
      { id: 2, name: 'Review', description: '', status: 'not_started' },
      { id: 1, name: 'Draft', description: 'Notes', status: 'not_started' },
    ]);
    expect(reordered.items).toEqual([
      {
        label: 'Order',
        format: 'short',
        action: 'reordered',
        before: 'M1 Draft, M2 Review',
        after: 'M1 Review, M2 Draft',
      },
    ]);

    const edited = questMilestoneChange(before, [
      {
        id: 1,
        name: 'Draft',
        description: 'Notes and proof',
        status: 'in_progress',
      },
      { name: 'Ship', description: '' },
    ]);
    expect(edited.items?.map((item) => item.label)).toEqual([
      'Milestone',
      'Milestone',
      'Draft description',
      'Draft status',
    ]);
    expect(edited.items?.[2]).toMatchObject({
      format: 'text',
      before: 'Notes',
      after: 'Notes and proof',
    });
    expect(edited.entity).toBe('milestone');
  });

  it('stores participant role and deliverable link changes on the one event', () => {
    const members = questMemberChange(
      [member({ id: 3, memberName: 'Ada', roleLabel: 'Builder' })],
      [{ id: 3, memberName: 'Ada', roleLabel: 'Reviewer' }],
    );
    expect(members.items).toEqual([
      {
        label: 'Ada role',
        format: 'short',
        action: 'updated',
        before: 'Builder',
        after: 'Reviewer',
      },
    ]);

    const deliverables = questDeliverableChange(
      [deliverable({ id: 4, name: 'Checklist', url: null, note: 'Draft' })],
      [{ id: 4, name: 'Checklist', url: 'https://example.com', note: 'Final' }],
    );
    expect(deliverables.items?.map((item) => item.label)).toEqual([
      'Checklist link',
      'Checklist note',
    ]);
    expect(deliverables.items?.[0]).toMatchObject({
      before: null,
      after: 'https://example.com',
    });
  });

  it('logs a milestone reorder with the old and new order', () => {
    const before = [
      milestone({ id: 1, name: 'First check' }),
      milestone({ id: 2, name: 'M2 reorder check' }),
    ];
    const reordered = questMilestoneChange(before, [
      { name: 'M2 reorder check' },
      { name: 'First check' },
    ]);
    expect(reordered.items).toEqual([
      {
        label: 'Order',
        format: 'short',
        action: 'reordered',
        before: 'M1 First check, M2 M2 reorder check',
        after: 'M1 M2 reorder check, M2 First check',
      },
    ]);
    expect(reordered.items?.some((item) => item.action === 'added')).toBe(
      false,
    );
  });

  it('omits item detail when the saved list did not change', () => {
    const before = [milestone({ id: 1, name: 'Draft', description: 'Notes' })];
    expect(
      questMilestoneChange(before, [
        { id: 1, name: 'Draft', description: 'Notes', status: 'not_started' },
      ]).items,
    ).toBeUndefined();
  });
});
