// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuestRecord, QuestStatus } from '@hypha-platform/core/client';
import { SpaceQuestDetail } from '../space-quest-detail';

const harness = vi.hoisted(() => ({
  personId: 7,
  status: 'active' as QuestStatus,
  chatRoomId: 'room-1' as string | null,
  setSpaceQuestDraft: vi.fn(),
  openCoherenceChat: vi.fn(),
  openHumanChatPanel: vi.fn(),
  closeAiPanel: vi.fn(),
}));

function questFixture(): QuestRecord {
  return {
    id: 1,
    spaceId: 1,
    spaceSlug: 'sandbox',
    spaceTitle: 'Sandbox',
    slug: 'onboarding',
    name: 'Onboarding',
    goal: 'Keep the saved goal',
    scopeIn: [],
    scopeOut: [],
    scopeInMarkdown: '',
    scopeOutMarkdown: '',
    successCriteria: '',
    rewards: [],
    status: harness.status,
    targetDate: null,
    leadPersonId: 7,
    leadName: 'Ada Lovelace',
    leadAvatarUrl: null,
    creatorPersonId: 7,
    proposalDocumentId: null,
    proposalSlug: null,
    proposalWeb3Id: null,
    proposalStatus: null,
    acceptedAt: null,
    chatRoomId: harness.chatRoomId,
    health: {
      state: 'on_track',
      marker: 50,
      summary: '',
      updatesThisWeek: 0,
      lastUpdateAt: null,
      generatedAt: null,
      daysToTarget: null,
    },
    stewardHealthSummaries: false,
    memberUpdateAlerts: false,
    milestones: [
      {
        id: 1,
        questId: 1,
        order: 1,
        name: 'Draft',
        description: 'Notes',
        dueDate: null,
        ownerPersonId: null,
        ownerName: null,
        status: 'not_started',
      },
      {
        id: 2,
        questId: 1,
        order: 2,
        name: 'Review',
        description: '',
        dueDate: null,
        ownerPersonId: null,
        ownerName: null,
        status: 'not_started',
      },
    ],
    members: [
      {
        id: 3,
        questId: 1,
        personId: 7,
        memberName: 'Ada Lovelace',
        memberAvatarUrl: null,
        roleLabel: 'Lead',
        responsibilities: [],
        order: 1,
        isLead: true,
      },
    ],
    deliverables: [],
    updates: [],
    latestUpdateLine: null,
    latestUpdateAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt={props.alt ?? ''} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    getAccessToken: async () => null,
    user: { id: 'user' },
    isLoading: false,
  }),
}));

vi.mock('@hypha-platform/core/client', async () => {
  const actual = await vi.importActual<
    typeof import('@hypha-platform/core/client')
  >('@hypha-platform/core/client');
  return {
    ...actual,
    useMe: () => ({
      person: {
        id: harness.personId,
        name: 'Ada',
        surname: 'Lovelace',
        avatarUrl: null,
      },
    }),
  };
});

vi.mock('../../../common/human-chat-panel-context', () => ({
  useAiPanel: () => ({ closeAiPanel: harness.closeAiPanel }),
  useHumanChatPanel: () => ({
    openCoherenceChat: harness.openCoherenceChat,
    openHumanChatPanel: harness.openHumanChatPanel,
    setSpaceQuestDraft: harness.setSpaceQuestDraft,
  }),
}));

vi.mock('../quest-reward-tokens', async () => {
  const actual = await vi.importActual<typeof import('../quest-reward-tokens')>(
    '../quest-reward-tokens',
  );
  return {
    ...actual,
    useQuestRewardTokenCatalog: () => ({ spaceTokens: [] }),
  };
});

vi.mock('../../hooks/use-space-quests', async () => {
  const actual = await vi.importActual<
    typeof import('../../hooks/use-space-quests')
  >('../../hooks/use-space-quests');
  return {
    ...actual,
    useSpaceQuestDetail: () => ({
      quest: questFixture(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    }),
    useQuestSpaceMembers: () => [],
  };
});

describe('saved quest helper entry', () => {
  afterEach(() => {
    cleanup();
    harness.personId = 7;
    harness.status = 'active';
    harness.chatRoomId = 'room-1';
    harness.setSpaceQuestDraft.mockReset();
    harness.openCoherenceChat.mockReset();
    harness.openHumanChatPanel.mockReset();
    harness.closeAiPanel.mockReset();
  });

  it('opens the create helper for an editor and leaves Open discussion on the room', () => {
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);

    expect(screen.getByTestId('open-quest-chat-button').textContent).toContain(
      'Open discussion',
    );
    fireEvent.click(screen.getByTestId('open-quest-helper-button'));
    expect(harness.openHumanChatPanel).toHaveBeenCalled();
    expect(harness.openCoherenceChat).not.toHaveBeenCalled();
    const helperSession = harness.setSpaceQuestDraft.mock.calls.at(-1)?.[0];
    expect(helperSession.coach).toBe('quest-helper');
    expect(helperSession.questTitle).toBe('Onboarding');

    fireEvent.click(screen.getByTestId('open-quest-chat-button'));
    expect(harness.openCoherenceChat).toHaveBeenCalledWith(
      'room-1',
      'Onboarding',
      'onboarding',
      'Keep the saved goal',
      'sandbox',
      { channel: 'quest' },
    );
    expect(screen.getByTestId('open-quest-chat-button').textContent).toContain(
      'Open discussion',
    );
  });

  it('hides the helper from a viewer who cannot edit', () => {
    harness.personId = 99;
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);
    expect(screen.queryByTestId('open-quest-helper-button')).toBeNull();
    expect(screen.getByTestId('open-quest-chat-button')).toBeTruthy();
  });

  it('lists overview milestones in saved order', () => {
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);
    const overview = screen.getByTestId('quest-overview-milestones');
    expect(overview.textContent?.indexOf('Draft')).toBeLessThan(
      overview.textContent?.indexOf('Review') ?? -1,
    );
    expect(overview.textContent).toContain('M1');
    expect(overview.textContent).toContain('M2');
  });
});
