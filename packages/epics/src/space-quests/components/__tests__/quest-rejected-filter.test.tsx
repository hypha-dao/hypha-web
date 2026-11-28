// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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
    origin: { kind: 'app' as const, clientLabel: null },
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

function proposalUpdate(questId: number) {
  return {
    id: questId,
    questId,
    authorPersonId: 9,
    authorName: 'Vlad Hramtsov',
    authorAvatarUrl: null,
    kind: 'post' as const,
    origin: { kind: 'app' as const, clientLabel: null },
    milestoneOrder: null,
    milestoneLabel: null,
    text: 'proposed, waiting for votes',
    links: [],
    change: null,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  };
}

const voting = quest({
  id: 1,
  slug: 'voting',
  name: 'Voting quest',
  status: 'proposed',
  proposalStatus: 'onVoting',
  updates: [proposalUpdate(1)],
});
const rejected = quest({
  id: 2,
  slug: 'voted-down',
  name: 'Voted down',
  status: 'proposed',
  proposalStatus: 'rejected',
  proposalDocumentId: 11,
  updates: [proposalUpdate(2)],
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
  useTranslations: () => (key: string) =>
    key === 'activity.proposalRejected' ? 'proposal rejected' : key,
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
    useSpaceBySlug: () => ({
      space: {
        slug: 'sandbox',
        leadImage: 'https://cdn.example/space.jpg',
      },
    }),
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

describe('rejected quest column', () => {
  it('lists a rejected proposal under Rejected and not under Proposed', () => {
    render(<SpaceQuestsSection spaceSlug="sandbox" />);

    const board = screen.getByTestId('quest-board');
    expect(board.getAttribute('data-layout')).toBe('kanban');
    expect(screen.queryByTestId('quest-status-filter')).toBeNull();
    expect(
      ['proposed', 'active', 'paused', 'completed', 'rejected'].map(
        (key) => screen.getByTestId(`quest-column-${key}`).textContent,
      ),
    ).toEqual([
      expect.stringContaining('filters.proposed'),
      expect.stringContaining('filters.active'),
      expect.stringContaining('filters.paused'),
      expect.stringContaining('filters.completed'),
      expect.stringContaining('filters.rejected'),
    ]);

    const proposed = screen.getByTestId('quest-column-proposed');
    expect(proposed.textContent).toContain('Voting quest');
    expect(proposed.textContent).not.toContain('Voted down');
    expect(screen.getByTestId('quest-card-voting').textContent).toContain(
      'Vlad · 3h ago: proposed, waiting for votes',
    );

    const card = screen.getByTestId('quest-card-voted-down');
    expect(screen.getByTestId('quest-column-rejected').contains(card)).toBe(
      true,
    );
    expect(card.textContent).toContain('Voted down');
    expect(card.textContent).toContain('Rejected');
    expect(card.textContent).toContain('Vlad · 3h ago: proposal rejected');
    expect(card.textContent).not.toContain('Proposed');
    expect(card.textContent).not.toContain('waiting for votes');
    expect(card.textContent).not.toMatch(/On track|Off track|Not started/);
    expect(card.querySelector('img')).toBeNull();
    expect(screen.queryByTestId('quest-card-image-voted-down')).toBeNull();
    expect(card.querySelector('[class*="border-error-8/70"]')).toBeTruthy();
  });
});
