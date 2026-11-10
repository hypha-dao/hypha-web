// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuestRecord } from '@hypha-platform/core/client';
import { SpaceQuestsSection } from '../space-quests-section';

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
    proposalDocumentId: 10,
    proposalSlug: 'proposal',
    proposalWeb3Id: 7,
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

const voting = quest({
  id: 1,
  slug: 'voting',
  name: 'Voting quest',
  status: 'proposed',
  proposalStatus: 'onVoting',
});
const rejected = quest({
  id: 2,
  slug: 'voted-down',
  name: 'Voted down',
  status: 'proposed',
  proposalStatus: 'rejected',
  proposalDocumentId: 11,
});

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    getAccessToken: async () => 'token',
  }),
}));

vi.mock('@hypha-platform/core/client', async () => {
  const actual = await vi.importActual<
    typeof import('@hypha-platform/core/client')
  >('@hypha-platform/core/client');
  return {
    ...actual,
    useSpaceBySlug: () => ({ space: { slug: 'sandbox' } }),
  };
});

vi.mock('../../../spaces/hooks/use-can-mutate-in-space.web3.rpc', () => ({
  useCanMutateInSpace: () => ({ canMutate: false }),
}));

vi.mock('../../hooks/use-space-quests', () => ({
  useSpaceQuests: () => ({
    overview: {
      quests: [voting, rejected],
      counts: {
        active: 0,
        proposed: 1,
        paused: 0,
        completed: 0,
        rejected: 1,
        archived: 0,
        total: 2,
      },
    },
    isLoading: false,
    error: undefined,
    refresh: vi.fn(),
  }),
  useMyQuestDrafts: () => ({ drafts: [], visible: true }),
  deleteQuestDraftRequest: vi.fn(),
  useQuestSpaceMembers: () => [],
  findQuestSpaceMember: () => null,
}));

afterEach(() => {
  cleanup();
});

describe('rejected quest filter', () => {
  it('lists a rejected proposal under Rejected and not under Proposed', () => {
    render(<SpaceQuestsSection spaceSlug="sandbox" />);

    expect(
      screen.getAllByRole('tab').map((tab) => tab.getAttribute('data-testid')),
    ).toEqual([
      'quest-filter-active',
      'quest-filter-proposed',
      'quest-filter-paused',
      'quest-filter-completed',
      'quest-filter-rejected',
      'quest-filter-drafts',
    ]);

    fireEvent.click(screen.getByTestId('quest-filter-proposed'));
    expect(screen.getByText('Voting quest')).toBeTruthy();
    expect(screen.queryByText('Voted down')).toBeNull();
    expect(screen.getByTestId('quest-card-voting').textContent).toContain(
      'Proposed',
    );

    fireEvent.click(screen.getByTestId('quest-filter-rejected'));
    expect(screen.queryByText('Voting quest')).toBeNull();
    const card = screen.getByTestId('quest-card-voted-down');
    expect(card.textContent).toContain('Voted down');
    expect(card.textContent).toContain('Rejected');
    expect(card.textContent).toContain('proposal rejected');
    expect(card.textContent).not.toContain('Proposed');
    expect(card.textContent).not.toContain('waiting for votes');
    expect(card.textContent).not.toMatch(/On track|Off track|Not started/);
  });
});
