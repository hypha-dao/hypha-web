// @vitest-environment jsdom

import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuestRecord } from '@hypha-platform/core/client';
import { COMPACT_EDITOR_TOOLBAR_BUTTON_CLASS } from '@hypha-platform/ui';
import {
  QuestDetailSubheading,
  QuestMilestonesCard,
  QuestParticipantsCard,
  QuestRewardStrip,
  QuestTargetDateCard,
  questDetailProgressLabel,
  questMilestoneMetaLines,
  questParticipantRoleText,
  resolveQuestLeadIdentity,
} from '../quest-detail-presentation';
import {
  EditQuestMembersModal,
  EditQuestMilestonesModal,
} from '../quest-section-edit-modals';
import {
  QUEST_LIST_GRID_CLASS,
  QUEST_LIST_TITLE_CLASS,
  QuestCard,
  questCardTargetLabel,
} from '../space-quests-section';

vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <img alt={props.alt ?? ''} />,
}));

afterEach(() => {
  cleanup();
});

function follows(before: Element, after: Element) {
  return (
    (before.compareDocumentPosition(after) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
    0
  );
}

describe('quest detail presentation', () => {
  it('orders Lead, then the avatar, then the saved name', () => {
    expect(resolveQuestLeadIdentity({ leadName: '  ' })).toBeNull();
    expect(resolveQuestLeadIdentity({ leadName: 'Lead' })?.name).toBe('Lead');
    render(
      <QuestDetailSubheading
        lead={resolveQuestLeadIdentity({
          leadName: 'Ada Lovelace',
          avatarSrc: '/ada.png',
          personId: 4,
        })}
        progress={null}
      />,
    );
    const label = screen.getByTestId('quest-lead-label');
    const avatar = screen.getByTestId('quest-lead-avatar');
    const name = screen.getByTestId('quest-lead-name');
    expect(label.textContent).toBe('Lead');
    expect(name.textContent).toBe('Ada Lovelace');
    expect(follows(label, avatar)).toBe(true);
    expect(follows(avatar, name)).toBe(true);
    expect(screen.queryByText(/^Target/)).toBeNull();
    expect(screen.queryByText(/Milestone \d+ of/)).toBeNull();
  });

  it('hides proposed progress and keeps an active milestone count', () => {
    expect(
      questDetailProgressLabel({
        status: 'proposed',
        milestones: [
          { status: 'not_started' },
          { status: 'not_started' },
          { status: 'not_started' },
        ],
      }),
    ).toBeNull();
    expect(
      questDetailProgressLabel({
        status: 'active',
        milestones: [
          { status: 'done' },
          { status: 'in_progress' },
          { status: 'not_started' },
        ],
      }),
    ).toBe('Milestone 2 of 3');
    expect(
      questDetailProgressLabel({
        status: 'paused',
        milestones: [],
      }),
    ).toBe('No milestones yet');
  });

  it('stacks milestone title, owner, and date on separate lines and expands independently', () => {
    expect(
      questMilestoneMetaLines(
        { ownerName: 'Grace Hopper', dueDate: '2026-11-20' },
        'en',
      ),
    ).toEqual({ owner: 'Grace Hopper', date: '20 November 2026' });
    expect(
      questMilestoneMetaLines({ ownerName: '   ', dueDate: '' }, 'en'),
    ).toEqual({ owner: null, date: null });

    render(
      <QuestMilestonesCard
        locale="en"
        milestones={[
          {
            id: 1,
            order: 1,
            name: 'Draft the brief',
            description: 'Write the first pass',
            dueDate: '2026-11-20',
            ownerName: 'Grace Hopper',
            status: 'not_started',
          },
          {
            id: 2,
            order: 2,
            name: 'Review',
            description: '',
            dueDate: null,
            ownerName: null,
            status: 'in_progress',
          },
          {
            id: 3,
            order: 3,
            name: 'Ship',
            description: 'Release notes',
            dueDate: '2026-12-01',
            ownerName: '  ',
            status: 'not_started',
          },
        ]}
      />,
    );

    const owner = screen.getByTestId('quest-milestone-owner-1');
    const date = screen.getByTestId('quest-milestone-date-1');
    expect(owner.textContent).toBe('Grace Hopper');
    expect(date.textContent).toBe('20 November 2026');
    expect(owner.nextElementSibling).toBe(date);
    expect(owner.className).toContain('block');
    expect(date.className).toContain('block');
    expect(owner.parentElement?.textContent).not.toContain('·');
    expect(owner.parentElement?.textContent).not.toContain('—');
    expect(screen.queryByTestId('quest-milestone-owner-2')).toBeNull();
    expect(screen.queryByTestId('quest-milestone-date-2')).toBeNull();
    expect(screen.queryByTestId('quest-milestone-owner-3')).toBeNull();
    expect(screen.getByTestId('quest-milestone-date-3').textContent).toBe(
      '1 December 2026',
    );

    const first = screen.getByTestId('quest-milestone-toggle-1');
    const second = screen.getByTestId('quest-milestone-toggle-2');
    expect(second.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(first);
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(second.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Write the first pass')).toBeTruthy();
    fireEvent.click(second);
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(second.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps participant roles and points without a responsibilities count', () => {
    expect(
      questParticipantRoleText({ roleLabel: '  ', isLead: false }),
    ).toBeNull();
    expect(questParticipantRoleText({ roleLabel: null, isLead: true })).toBe(
      'Lead',
    );
    expect(
      questParticipantRoleText({ roleLabel: 'Writer', isLead: true }),
    ).toBe('Writer');

    render(
      <QuestParticipantsCard
        members={[
          {
            id: 7,
            memberName: 'Ada Lovelace',
            roleLabel: 'Researcher',
            responsibilities: ['Write the brief', 'Review the draft'],
          },
          {
            id: 8,
            memberName: 'Grace Hopper',
            roleLabel: null,
            isLead: false,
            responsibilities: ['Own the checklist'],
          },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Participants' })).toBeTruthy();
    expect(screen.queryByText(/\d+\s+responsibilit/i)).toBeNull();
    expect(screen.getByText('RESPONSIBILITY')).toBeTruthy();
    expect(screen.getByText('Researcher')).toBeTruthy();
    const ada = screen.getByTestId('quest-participant-toggle-7');
    const grace = screen.getByTestId('quest-participant-toggle-8');
    expect(ada.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(grace);
    expect(ada.getAttribute('aria-expanded')).toBe('true');
    expect(grace.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Write the brief')).toBeTruthy();
    expect(screen.getByText('Review the draft')).toBeTruthy();
    expect(screen.getByText('Own the checklist')).toBeTruthy();
    fireEvent.click(ada);
    expect(ada.getAttribute('aria-expanded')).toBe('false');
    expect(grace.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows a Target Date card only through the formatted value', () => {
    render(<QuestTargetDateCard label="20 November 2026" />);
    expect(screen.getByRole('heading', { name: 'Target Date' })).toBeTruthy();
    expect(screen.getByTestId('quest-target-date-value').textContent).toBe(
      '20 November 2026',
    );
  });

  it('lays reward tokens out as compact wrapping boxes', () => {
    render(
      <QuestRewardStrip
        rewards={[
          { amount: '250', token: 'USDC' },
          { amount: '10', token: 'HYPHA' },
        ]}
      />,
    );
    const strip = screen.getByTestId('quest-reward-strip');
    expect(strip.className).toContain('flex-wrap');
    expect(strip.className).not.toContain('grid-cols-2');
    expect(strip.textContent).toContain('250');
    expect(
      Array.from(strip.children).every((child) =>
        (child as HTMLElement).className.includes('w-[11.5rem]'),
      ),
    ).toBe(true);
    expect(screen.getByText('250')).toBeTruthy();
    expect(screen.getAllByText('USDC').length).toBeGreaterThan(0);
  });
});

describe('participant role editor', () => {
  it('edits the stored role and preserves the other participant fields', () => {
    const onSave = vi.fn();
    render(
      <EditQuestMembersModal
        open
        onOpenChange={() => undefined}
        members={[
          {
            id: 11,
            personId: 4,
            memberName: 'Ada Lovelace',
            memberAvatarUrl: null,
            roleLabel: 'Researcher',
            responsibilities: ['Write the brief', 'Review the draft'],
          },
          {
            id: 12,
            personId: 5,
            memberName: 'Grace Hopper',
            roleLabel: null,
            responsibilities: ['Own the checklist'],
          },
        ]}
        onSave={onSave}
      />,
    );

    const adaRole = screen.getByTestId(
      'quest-participant-role-0',
    ) as HTMLInputElement;
    const graceRole = screen.getByTestId(
      'quest-participant-role-1',
    ) as HTMLInputElement;
    expect(adaRole.value).toBe('Researcher');
    expect(graceRole.value).toBe('');
    expect(adaRole.className).toContain('h-10');
    fireEvent.change(adaRole, { target: { value: 'Writer' } });
    fireEvent.change(graceRole, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 11,
        personId: 4,
        memberName: 'Ada Lovelace',
        roleLabel: 'Writer',
        responsibilities: ['Write the brief', 'Review the draft'],
      }),
      expect.objectContaining({
        id: 12,
        personId: 5,
        memberName: 'Grace Hopper',
        roleLabel: null,
        responsibilities: ['Own the checklist'],
      }),
    ]);

    const saved = onSave.mock.calls[0][0] as Array<{
      id: number;
      memberName: string;
      roleLabel: string | null;
      responsibilities: string[];
      isLead?: boolean;
    }>;
    cleanup();
    render(
      <QuestParticipantsCard
        members={saved.map((member) => ({
          ...member,
          isLead: member.id === 12,
        }))}
      />,
    );
    expect(screen.getByText('Writer')).toBeTruthy();
    expect(screen.getByText('Lead')).toBeTruthy();
    expect(screen.queryByText('Member')).toBeNull();
  });
});

describe('milestone editor', () => {
  it('drops the insert instruction, uses Add milestone here, and keeps a neutral card', () => {
    render(
      <EditQuestMilestonesModal
        open
        onOpenChange={() => undefined}
        milestones={[
          {
            id: 1,
            name: 'Draft',
            description: 'Notes',
            dueDate: '2026-11-20',
            ownerName: null,
            ownerPersonId: null,
            status: 'not_started',
          },
          {
            id: 2,
            name: 'Review',
            description: '',
            dueDate: null,
            ownerName: 'Ada Lovelace',
            ownerPersonId: null,
            status: 'not_started',
          },
        ]}
        onSave={() => undefined}
      />,
    );

    expect(screen.queryByText(/inserted after/i)).toBeNull();
    expect(screen.queryByText(/No need to write/i)).toBeNull();
    expect(screen.queryByText(/Hover between/i)).toBeNull();
    const insert = screen.getByTestId('insert-milestone-before-2');
    expect(insert.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Add milestone here',
    );
    expect(insert.className).not.toMatch(/3d3d8f|f3f3fa|rounded-full/);
    expect(insert.className).toContain('border-border');
    expect(insert.className).toContain('bg-background');
    fireEvent.click(insert);
    expect(screen.queryByText(/inserted after/i)).toBeNull();
    expect(screen.getAllByText(/Add milestone here/).length).toBeGreaterThan(0);
    expect(screen.getByText('M1')).toBeTruthy();
    expect(screen.getByDisplayValue('Draft')).toBeTruthy();

    const owner = screen.getByTestId('quest-milestone-owner-1');
    const combobox = within(owner).getByRole('combobox');
    expect(combobox.className).toContain('px-3');
    expect(combobox.className).toContain('text-left');
    expect(combobox.className).toContain('justify-between');
    expect(combobox.className).toContain('normal-case');
    expect(combobox.className).not.toMatch(/(?:^|\s)uppercase(?:\s|$)/);
    expect(within(owner).getByText('Unassigned')).toBeTruthy();

    const heading = screen.getAllByRole('button', { name: 'Heading 1' })[0];
    const bold = screen.getAllByRole('button', { name: 'Bold' })[0];
    if (!heading || !bold) {
      throw new Error('Expected Heading 1 and Bold toolbar controls');
    }
    for (const control of [heading, bold]) {
      expect(control.className).toContain('min-h-[32px]');
      expect(control.className).toContain('h-[32px]');
      expect(control.className).toContain('w-[32px]');
      expect(control.getAttribute('aria-label')).toBeTruthy();
      expect(control.className).not.toContain('min-h-8');
      expect(control.className).not.toContain('h-9');
    }
    expect(COMPACT_EDITOR_TOOLBAR_BUTTON_CLASS).toContain('32px');
    const toolbars = screen.getAllByRole('toolbar');
    expect(toolbars.length).toBeGreaterThan(0);
    for (const toolbar of toolbars) {
      expect(toolbar.getAttribute('data-toolbar-density')).toBe('compact');
    }
  });
});

function questFixture(
  overrides: Partial<QuestRecord> & Pick<QuestRecord, 'slug' | 'name'>,
): QuestRecord {
  return {
    id: 1,
    spaceId: 1,
    spaceSlug: 'alpha',
    spaceTitle: 'Alpha',
    goal: 'Ship the checklist',
    scopeIn: [],
    scopeOut: [],
    scopeInMarkdown: '',
    scopeOutMarkdown: '',
    successCriteria: '',
    rewards: [],
    status: 'active',
    targetDate: null,
    leadPersonId: 1,
    leadName: 'Ada Lovelace',
    leadAvatarUrl: null,
    creatorPersonId: 1,
    proposalDocumentId: null,
    proposalSlug: null,
    proposalWeb3Id: null,
    proposalStatus: null,
    acceptedAt: null,
    chatRoomId: null,
    health: {
      state: 'on_track',
      marker: 80,
      summary: '',
      updatesThisWeek: 0,
      lastUpdateAt: null,
      generatedAt: null,
      daysToTarget: 12,
    },
    stewardHealthSummaries: false,
    memberUpdateAlerts: false,
    milestones: [],
    members: [],
    deliverables: [],
    updates: [],
    latestUpdateLine: null,
    latestUpdateAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('quest list cards', () => {
  it('matches the space tab title classes and omits a missing target row', () => {
    expect(QUEST_LIST_TITLE_CLASS).toContain('craft-page-title');
    expect(QUEST_LIST_TITLE_CLASS).toContain('text-6');
    expect(QUEST_LIST_TITLE_CLASS).toContain('font-medium');
    expect(QUEST_LIST_TITLE_CLASS).not.toContain('text-[22px]');
    expect(questCardTargetLabel(null, 'en')).toBeNull();
    expect(questCardTargetLabel('   ', 'en')).toBeNull();
    expect(questCardTargetLabel('2026-11-20', 'en')).toBe(
      'Target 20 November 2026',
    );

    const short = questFixture({
      slug: 'short',
      name: 'Short title',
      targetDate: null,
    });
    const long = questFixture({
      slug: 'long',
      name: 'A very long quest title that must wrap inside the card instead of being clipped at the edge of a narrow column',
      targetDate: '2026-11-20',
      leadName: 'Grace Hopper',
    });
    render(
      <div className={QUEST_LIST_GRID_CLASS} data-testid="quest-list-grid">
        <QuestCard quest={short} href="/short" />
        <QuestCard quest={long} href="/long" />
      </div>,
    );
    const grid = screen.getByTestId('quest-list-grid');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(grid.className).toContain('[grid-auto-rows:1fr]');
    const shortCard = screen.getByTestId('quest-card-short');
    const longCard = screen.getByTestId('quest-card-long');
    expect(shortCard.className).toContain('h-full');
    expect(longCard.className).toContain('h-full');
    expect(shortCard.className).toContain('min-w-0');
    expect(shortCard.querySelector('h2')).toBeTruthy();
    expect(shortCard.querySelector('h2')?.className).not.toContain('truncate');
    expect(longCard.querySelector('h2')?.className).toContain('break-words');
    expect(screen.queryByTestId('quest-card-target-short')).toBeNull();
    expect(screen.queryByText(/Target\s*[—–-]\s*$/)).toBeNull();
    expect(screen.getByTestId('quest-card-target-long').textContent).toBe(
      'Target 20 November 2026',
    );
    expect(shortCard.textContent).not.toContain('Target');
  });
});
