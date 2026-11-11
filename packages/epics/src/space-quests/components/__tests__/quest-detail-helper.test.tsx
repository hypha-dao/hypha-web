// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestRecord, QuestStatus } from '@hypha-platform/core/client';
import { SpaceQuestDetail } from '../space-quest-detail';

const harness = vi.hoisted(() => ({
  personId: 7,
  status: 'active' as QuestStatus,
  chatRoomId: 'room-1' as string | null,
  quest: null as QuestRecord | null,
  setSpaceQuestDraft: vi.fn(),
  openCoherenceChat: vi.fn(),
  openHumanChatPanel: vi.fn(),
  closeCoherenceChat: vi.fn(),
  closeHumanChatPanel: vi.fn(),
  requestQuestChat: vi.fn(),
  dismissQuestChat: vi.fn(),
  closeAiPanel: vi.fn(),
  postUpdate: vi.fn(),
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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
    closeCoherenceChat: harness.closeCoherenceChat,
    closeHumanChatPanel: harness.closeHumanChatPanel,
    requestQuestChat: harness.requestQuestChat,
    dismissQuestChat: harness.dismissQuestChat,
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
      quest: harness.quest ?? questFixture(),
      isLoading: false,
      error: null,
      refresh: async (next?: QuestRecord) => {
        if (next && typeof next === 'object' && 'slug' in next) {
          harness.quest = next;
        }
      },
    }),
    useQuestSpaceMembers: () => [],
    postSpaceQuestUpdateRequest: (input: {
      body: {
        text: string;
        milestoneOrder?: number | null;
        milestoneLabel?: string | null;
        links?: { label: string; url: string; kind?: string }[];
      };
    }) => harness.postUpdate(input),
  };
});

function installPointerCapture() {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
}

class LoadedImage {
  complete = true;
  naturalWidth = 8;
  private currentSrc = '';
  get src() {
    return this.currentSrc;
  }
  set src(value: string) {
    this.currentSrc = value;
  }
  addEventListener() {}
  removeEventListener() {}
}

describe('saved quest helper entry', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', LoadedImage);
    harness.personId = 7;
    harness.status = 'active';
    harness.chatRoomId = 'room-1';
    harness.quest = questFixture();
    harness.postUpdate.mockImplementation(
      async (input: { body: { text: string } }) => postedQuest(input.body.text),
    );
  });

  afterEach(() => {
    cleanup();
    harness.personId = 7;
    harness.status = 'active';
    harness.chatRoomId = 'room-1';
    harness.quest = questFixture();
    harness.setSpaceQuestDraft.mockReset();
    harness.openCoherenceChat.mockReset();
    harness.openHumanChatPanel.mockReset();
    harness.closeCoherenceChat.mockReset();
    harness.closeHumanChatPanel.mockReset();
    harness.requestQuestChat.mockReset();
    harness.dismissQuestChat.mockReset();
    harness.closeAiPanel.mockReset();
    harness.postUpdate.mockReset();
    vi.unstubAllGlobals();
  });

  function postedQuest(text: string): QuestRecord {
    const quest = harness.quest ?? questFixture();
    return {
      ...quest,
      updates: [
        {
          id: 50,
          questId: quest.id,
          authorPersonId: 7,
          authorName: 'Ada Lovelace',
          authorAvatarUrl: 'https://example.com/ada.png',
          kind: 'post',
          viaAgent: false,
          milestoneOrder: null,
          milestoneLabel: null,
          text,
          links: [],
          change: null,
          createdAt: '2026-11-09T15:04:00.000Z',
        },
        ...quest.updates,
      ],
    };
  }

  function settingsAction(label: string) {
    const labelNode = screen.getByText(label);
    const button =
      labelNode.parentElement?.parentElement?.querySelector('button');
    if (!button) throw new Error(`missing settings action for ${label}`);
    return button;
  }

  it('keeps overview read-only, including the participants list', () => {
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);

    expect(screen.queryByTestId('open-quest-helper-button')).toBeNull();
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    expect(screen.queryByLabelText(/edit quest name/i)).toBeNull();
    expect(screen.queryByTestId('quest-participant-role-0')).toBeNull();
    expect(screen.queryByText('ADD PARTICIPANT')).toBeNull();
    expect(screen.queryByText(/any participant can edit/i)).toBeNull();
    const title = screen.getByRole('heading', { name: 'Onboarding' });
    expect(title.className).toContain('m-0');
    expect(title.className).toContain('text-4');
    expect(title.className).toContain('leading-tight');
    expect(
      screen.getByTestId('open-quest-discussion-button').textContent,
    ).toContain('Open discussion');

    const participants = screen.getByTestId('quest-overview-members');
    const participantsHeading = screen.getByRole('heading', {
      name: 'Participants',
    });
    expect(participantsHeading.className).toContain('font-display');
    expect(participantsHeading.className).toContain('text-[15px]');
    expect(participantsHeading.className).not.toMatch(
      /(?:^|\s)uppercase(?:\s|$)/,
    );
    const participantName = participants.querySelector(
      '[data-testid="quest-participant-toggle-3"]',
    );
    expect(participantName?.textContent).toContain('Ada Lovelace');
    expect(participantName?.textContent).toContain('Lead');
    expect(participantName?.className ?? '').not.toMatch(
      /(?:^|\s)uppercase(?:\s|$)/,
    );
    expect(screen.getByTestId('quest-participant-toggle-3').tagName).toBe(
      'BUTTON',
    );
  });

  it('opens the quest discussion room and keeps the helper off the page', () => {
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="settings"
      />,
    );

    expect(screen.queryByTestId('open-quest-helper-button')).toBeNull();
    expect(screen.queryByText('Quest Helper')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Participants' })).toBeNull();
    fireEvent.click(screen.getByTestId('open-quest-discussion-button'));
    expect(harness.openCoherenceChat).not.toHaveBeenCalled();
    expect(harness.closeCoherenceChat).toHaveBeenCalled();
    expect(harness.openHumanChatPanel).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('open-quest-chat-button'));
    expect(harness.openCoherenceChat).toHaveBeenCalledWith(
      'room-1',
      'Onboarding',
      'onboarding',
      'Keep the saved goal',
      'sandbox',
      { channel: 'quest' },
    );
    expect(harness.setSpaceQuestDraft).toHaveBeenCalledWith(null);
    expect(
      screen.getByTestId('open-quest-chat-button').getAttribute('aria-label'),
    ).toBe('Quest chat');
  });

  it('edits the quest name, participants, and paused health from Settings', () => {
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="settings"
      />,
    );

    expect(screen.queryByText('Quest health')).toBeNull();
    fireEvent.click(settingsAction('Quest name'));
    expect(screen.getByRole('heading', { name: 'Edit name' })).toBeTruthy();

    fireEvent.click(settingsAction('Participants'));
    expect(
      screen.getByRole('heading', { name: 'Edit participants' }),
    ).toBeTruthy();
    expect(screen.getByTestId('quest-participant-role-0')).toBeTruthy();
    expect(screen.getByTestId('quest-new-participant-role')).toBeTruthy();
    expect(screen.getByText('ADD PARTICIPANT')).toBeTruthy();

    cleanup();
    harness.status = 'paused';
    harness.quest = questFixture();
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="settings"
      />,
    );
    fireEvent.click(settingsAction('Quest health'));
    expect(
      screen.getByRole('heading', { name: 'Edit quest health' }),
    ).toBeTruthy();
  });

  it('hides the helper from a viewer who cannot edit', () => {
    harness.personId = 99;
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="settings"
      />,
    );
    expect(screen.queryByTestId('open-quest-helper-button')).toBeNull();
    expect(screen.getByTestId('open-quest-chat-button')).toBeTruthy();
    expect(settingsAction('Quest name')).toHaveProperty('disabled', true);
    expect(settingsAction('Participants')).toHaveProperty('disabled', true);
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

  it('shows a dated active quest on track in the green part of the bar', () => {
    const quest = questFixture();
    quest.targetDate = '2099-01-01';
    quest.milestones = quest.milestones.map((milestone) => ({
      ...milestone,
      dueDate: '2099-01-01',
    }));
    quest.health = { ...quest.health, marker: 0, state: 'off_track' };
    harness.quest = quest;
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);

    const health = screen.getByTestId('quest-overview-health');
    expect(screen.getByTestId('quest-health-label').textContent).toContain(
      'On track',
    );
    expect(screen.getByTestId('quest-health-scale-start').textContent).toBe(
      'Off track',
    );
    expect(screen.getByTestId('quest-health-scale-end').textContent).toBe(
      'On track',
    );
    expect(health.textContent).not.toMatch(/healthy/i);
    expect(health.innerHTML).toContain('#2e9e5b');
    expect(
      screen.getByTestId('quest-health-marker').getAttribute('data-marker'),
    ).toBe('80');
    expect(health.querySelector('button')).toBeNull();
  });

  it('shows off track in red when an incomplete milestone has no date', () => {
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);
    const health = screen.getByTestId('quest-overview-health');
    expect(screen.getByTestId('quest-health-label').textContent).toContain(
      'Off track',
    );
    expect(screen.getByTestId('quest-health-scale-start').textContent).toBe(
      'Off track',
    );
    expect(screen.getByTestId('quest-health-scale-end').textContent).toBe(
      'On track',
    );
    expect(health.textContent).not.toMatch(/healthy/i);
    expect(health.innerHTML).toContain('#d2463c');
    expect(
      screen.getByTestId('quest-health-marker').getAttribute('data-marker'),
    ).toBe('15');
  });

  it('shows a completed quest at the end of the health bar without a health tag', () => {
    harness.status = 'completed';
    const quest = questFixture();
    quest.targetDate = '2020-01-01';
    quest.health = { ...quest.health, state: 'off_track', marker: 12 };
    harness.quest = quest;
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);

    const header = screen
      .getByRole('heading', { name: 'Onboarding' })
      .closest('header');
    expect(header?.textContent).toContain('Completed');
    expect(header?.textContent).not.toMatch(
      /On track|Off track|At risk|Not started/,
    );
    expect(screen.queryByTestId('quest-health-label')).toBeNull();
    const marker = screen.getByTestId('quest-health-marker');
    expect(marker.getAttribute('data-marker')).toBe('100');
    expect(marker.className).toContain('right-0');
  });

  it('shows Rejected instead of Proposed and hides the health tag', () => {
    harness.status = 'proposed';
    const quest = questFixture();
    quest.proposalStatus = 'rejected';
    harness.quest = quest;
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);

    const header = screen
      .getByRole('heading', { name: 'Onboarding' })
      .closest('header');
    expect(header?.textContent).toContain('Rejected');
    expect(header?.textContent).not.toContain('Proposed');
    expect(header?.textContent).not.toMatch(/On track|Off track|Not started/);
    expect(screen.queryByTestId('quest-health-label')).toBeNull();
  });

  it('posts a written update from the milestone menu without a link field', async () => {
    installPointerCapture();
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="updates"
      />,
    );

    const composer = screen.getByTestId('quest-update-composer');
    expect(composer.className).toContain('px-3');
    expect(composer.className).toContain('pt-3');
    expect(composer.innerHTML).toContain('rounded-none');
    expect(composer.innerHTML).toContain('border-border');
    expect(composer.innerHTML).toContain('bg-neutral-1');
    expect(screen.getByLabelText('Share progress').className).toContain('px-3');
    expect(screen.getByLabelText('Share progress').className).toContain(
      'py-2.5',
    );
    expect(screen.queryByLabelText('Link (optional)')).toBeNull();
    expect(composer.querySelector('select')).toBeNull();
    const milestone = screen.getByTestId('quest-update-milestone');
    expect(milestone.className).toContain('px-3');
    expect(milestone.className).toContain('h-10');
    expect(milestone.querySelector('svg')).toBeTruthy();

    const post = screen.getByTestId('quest-update-post');
    expect(post).toHaveProperty('disabled', true);
    fireEvent.pointerDown(milestone, { button: 0, pointerId: 1 });
    fireEvent.click(milestone);
    fireEvent.click(await screen.findByRole('option', { name: 'M1 · Draft' }));
    expect(post).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText('Share progress'), {
      target: { value: 'Shipped the checklist' },
    });
    expect(post).toHaveProperty('disabled', false);
    fireEvent.click(post);

    expect(await screen.findByText('Shipped the checklist')).toBeTruthy();
    const card = screen.getByTestId('quest-update-card');
    expect(card.textContent).toContain('Ada Lovelace');
    expect(
      card
        .querySelector('[data-testid="quest-update-avatar"] img')
        ?.getAttribute('src'),
    ).toBe('https://example.com/ada.png');
    expect(harness.postUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          text: 'Shipped the checklist',
          milestoneOrder: 1,
          milestoneLabel: 'M1',
          links: [],
        }),
      }),
    );
  });

  it('hides the composer from someone who cannot edit', () => {
    harness.personId = 99;
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="updates"
      />,
    );
    expect(screen.queryByTestId('quest-update-composer')).toBeNull();
    expect(screen.queryByTestId('quest-update-post')).toBeNull();
  });
});
