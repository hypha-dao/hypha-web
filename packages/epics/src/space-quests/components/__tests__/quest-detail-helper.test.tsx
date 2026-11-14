// @vitest-environment jsdom

import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestRecord, QuestStatus } from '@hypha-platform/core/client';
import { SpaceQuestDetail } from '../space-quest-detail';

const harness = vi.hoisted(() => ({
  personId: 7,
  status: 'active' as QuestStatus,
  chatRoomId: 'room-1' as string | null,
  refreshedRoomId: null as string | null,
  jwt: null as string | null,
  quest: null as QuestRecord | null,
  createRoom: vi.fn(async () => ({ roomId: '!created:room' })),
  joinRoom: vi.fn(async (roomId: string) => roomId),
  updateAgreementBySlug: vi.fn(async () => undefined),
  setSpaceQuestDraft: vi.fn(),
  openCoherenceChat: vi.fn(),
  openHumanChatPanel: vi.fn(),
  closeCoherenceChat: vi.fn(),
  closeHumanChatPanel: vi.fn(),
  requestQuestChat: vi.fn(),
  dismissQuestChat: vi.fn(),
  closeAiPanel: vi.fn(),
  postUpdate: vi.fn(),
  patchQuest: vi.fn(),
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
    deliverablesEnabled: false,
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

vi.mock('next/dynamic', () => ({
  default: (
    loader: () => Promise<
      | React.ComponentType<Record<string, unknown>>
      | { default: React.ComponentType<Record<string, unknown>> }
    >,
  ) => {
    const Lazy = React.lazy(async () => {
      const loaded = await loader();
      if (typeof loaded === 'function') {
        return { default: loaded };
      }
      return loaded;
    });
    return function DynamicComponent(props: Record<string, unknown>) {
      return (
        <React.Suspense fallback={null}>
          <Lazy {...props} />
        </React.Suspense>
      );
    };
  },
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
    useJwt: () => ({ jwt: harness.jwt, isLoadingJwt: false }),
    useMatrix: () => ({
      createRoom: harness.createRoom,
      joinRoom: harness.joinRoom,
    }),
    useAgreementMutationsWeb2Rsc: () => ({
      updateAgreementBySlug: harness.updateAgreementBySlug,
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
          return next;
        }
        if (!harness.refreshedRoomId) return undefined;
        return { ...questFixture(), chatRoomId: harness.refreshedRoomId };
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
    patchSpaceQuestRequest: (input: unknown) => harness.patchQuest(input),
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
    harness.refreshedRoomId = null;
    harness.jwt = null;
    harness.quest = questFixture();
    harness.createRoom.mockReset();
    harness.createRoom.mockImplementation(async () => ({
      roomId: '!created:room',
    }));
    harness.joinRoom.mockReset();
    harness.joinRoom.mockImplementation(async (roomId: string) => roomId);
    harness.updateAgreementBySlug.mockReset();
    harness.updateAgreementBySlug.mockResolvedValue(undefined);
    harness.postUpdate.mockImplementation(
      async (input: { body: { text: string } }) => postedQuest(input.body.text),
    );
  });

  afterEach(() => {
    cleanup();
    harness.personId = 7;
    harness.status = 'active';
    harness.chatRoomId = 'room-1';
    harness.refreshedRoomId = null;
    harness.jwt = null;
    harness.quest = questFixture();
    harness.setSpaceQuestDraft.mockReset();
    harness.createRoom.mockReset();
    harness.joinRoom.mockReset();
    harness.updateAgreementBySlug.mockReset();
    harness.openCoherenceChat.mockReset();
    harness.openHumanChatPanel.mockReset();
    harness.closeCoherenceChat.mockReset();
    harness.closeHumanChatPanel.mockReset();
    harness.requestQuestChat.mockReset();
    harness.dismissQuestChat.mockReset();
    harness.closeAiPanel.mockReset();
    harness.postUpdate.mockReset();
    harness.patchQuest.mockReset();
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

    expect(screen.queryByTestId('quest-overview-deliverables')).toBeNull();
  });

  it('splits goal and scope into separate overview cards', () => {
    harness.quest = {
      ...questFixture(),
      goal: 'Keep the saved goal.\n\nA second paragraph.',
      scopeIn: ['Ship the matcher'],
      scopeInMarkdown: '- Ship the matcher\n- Keep the list',
      scopeOut: ['Rewrite the app'],
      scopeOutMarkdown: '- Rewrite the app',
      successCriteria: 'Members can find the quest.',
    };
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);

    expect(screen.queryByText('Scope & Goal')).toBeNull();
    const goal = screen.getByTestId('quest-overview-goal');
    const scope = screen.getByTestId('quest-overview-scope');
    const success = screen.getByTestId('quest-overview-success');
    expect(goal.querySelector('h2')?.textContent).toBe('overview.goal');
    expect(scope.querySelector('h2')?.textContent).toBe('overview.scope');
    expect(success.querySelector('h2')?.textContent).toBe(
      'overview.successCriteria',
    );
    for (const card of [goal, scope, success]) {
      expect(card.querySelector('h2')?.className).toContain('font-display');
      expect(card.querySelector('h2')?.className).toContain('text-[15px]');
    }
    const body = goal.querySelector('.space-y-3');
    expect(body?.className).toContain('text-2');
    expect(body?.className).toContain('leading-relaxed');
    expect(scope.querySelector('ul')?.className).toContain('space-y-1.5');
    expect(scope.innerHTML).not.toContain('border-border/60');
    expect(scope.textContent).toContain('overview.inScope');
    expect(scope.textContent).toContain('overview.outOfScope');
    expect(scope.textContent).toContain('Ship the matcher');
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();

    cleanup();
    harness.quest = {
      ...questFixture(),
      goal: '',
      scopeIn: [],
      scopeInMarkdown: '',
      scopeOut: [],
      scopeOutMarkdown: '',
      successCriteria: '',
    };
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);
    expect(screen.queryByTestId('quest-overview-goal')).toBeNull();
    expect(screen.queryByTestId('quest-overview-scope')).toBeNull();
    expect(screen.queryByTestId('quest-overview-success')).toBeNull();
  });

  it('shows the deliverables card only after the setting is on or items exist', () => {
    const { rerender } = render(
      <SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />,
    );
    expect(screen.queryByTestId('quest-overview-deliverables')).toBeNull();

    harness.quest = { ...questFixture(), deliverablesEnabled: true };
    rerender(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);
    expect(
      screen.getByTestId('quest-overview-deliverables').textContent,
    ).toContain('No deliverables yet');
    expect(
      screen.getByTestId('quest-overview-deliverables-action').textContent,
    ).toBe('Add');

    harness.quest = {
      ...questFixture(),
      deliverablesEnabled: false,
      deliverables: [
        {
          id: 9,
          questId: 1,
          name: 'Spec',
          url: 'https://example.com/spec',
          note: null,
          order: 1,
          updatedByPersonId: null,
          updatedByName: null,
          updatedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    };
    rerender(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);
    expect(
      screen.getByTestId('quest-overview-deliverables').textContent,
    ).toContain('Spec');
  });

  it('lets an editor turn deliverables on from settings and keeps stored items visible', () => {
    harness.patchQuest.mockImplementation(
      async (input: { patch: { deliverablesEnabled?: boolean } }) => ({
        ...(harness.quest ?? questFixture()),
        deliverablesEnabled: input.patch.deliverablesEnabled ?? false,
      }),
    );
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="settings"
      />,
    );
    const toggle = screen.getByTestId('quest-settings-deliverables-toggle');
    expect(toggle.textContent).toContain('settings.off');
    fireEvent.click(toggle);
    expect(harness.patchQuest).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: { deliverablesEnabled: true },
      }),
    );

    cleanup();
    harness.quest = {
      ...questFixture(),
      deliverables: [
        {
          id: 9,
          questId: 1,
          name: 'Spec',
          url: null,
          note: null,
          order: 1,
          updatedByPersonId: null,
          updatedByName: null,
          updatedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    };
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="settings"
      />,
    );
    const locked = screen.getByTestId('quest-settings-deliverables-toggle');
    expect(locked.textContent).toContain('settings.on');
    expect(locked).toHaveProperty('disabled', true);
  });

  it('hides Open discussion until the quest is accepted', () => {
    for (const status of [
      'proposed',
      'active',
      'paused',
      'completed',
      'archived',
    ] as const) {
      cleanup();
      harness.status = status;
      harness.chatRoomId = status === 'proposed' ? null : 'room-1';
      harness.personId = 7;
      harness.quest = questFixture();
      render(
        <SpaceQuestDetail
          spaceSlug="sandbox"
          questSlug="onboarding"
          tab="overview"
        />,
      );
      expect(screen.queryByTestId('open-quest-chat-button')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Quest chat' })).toBeNull();
      if (status === 'proposed') {
        expect(screen.queryByTestId('open-quest-discussion-button')).toBeNull();
        expect(
          screen.queryByRole('button', { name: /Open discussion/ }),
        ).toBeNull();
      } else {
        expect(screen.getByTestId('open-quest-discussion-button')).toBeTruthy();
      }
    }
  });

  it('opens the quest discussion from Open discussion and has no chat icon', async () => {
    for (const status of [
      'active',
      'paused',
      'completed',
      'archived',
    ] as const) {
      cleanup();
      harness.openCoherenceChat.mockReset();
      harness.openHumanChatPanel.mockReset();
      harness.requestQuestChat.mockReset();
      harness.createRoom.mockClear();
      harness.status = status;
      harness.chatRoomId = 'room-1';
      harness.quest = questFixture();
      render(
        <SpaceQuestDetail
          spaceSlug="sandbox"
          questSlug="onboarding"
          tab="settings"
        />,
      );

      expect(screen.queryByTestId('open-quest-helper-button')).toBeNull();
      expect(screen.queryByTestId('open-quest-chat-button')).toBeNull();
      expect(screen.queryByText('Quest Helper')).toBeNull();
      fireEvent.click(screen.getByTestId('open-quest-discussion-button'));
      await waitFor(() => {
        expect(harness.openCoherenceChat).toHaveBeenCalledWith(
          'room-1',
          'Onboarding',
          'onboarding',
          'Keep the saved goal',
          'sandbox',
          { channel: 'quest' },
        );
      });
      expect(harness.openHumanChatPanel).not.toHaveBeenCalled();
      expect(harness.requestQuestChat).not.toHaveBeenCalled();
      expect(harness.createRoom).not.toHaveBeenCalled();
    }
  });

  it('does not open or create a discussion for a proposed quest', () => {
    harness.status = 'proposed';
    harness.chatRoomId = null;
    const quest = questFixture();
    quest.proposalSlug = 'proposal-1';
    harness.quest = quest;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="overview"
      />,
    );

    expect(screen.queryByTestId('open-quest-discussion-button')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(harness.createRoom).not.toHaveBeenCalled();
    expect(harness.joinRoom).not.toHaveBeenCalled();
    expect(harness.updateAgreementBySlug).not.toHaveBeenCalled();
    expect(harness.openCoherenceChat).not.toHaveBeenCalled();
    expect(harness.requestQuestChat).not.toHaveBeenCalled();
    expect(harness.openHumanChatPanel).not.toHaveBeenCalled();
  });

  it('does not open a discussion for a rejected quest', () => {
    harness.status = 'proposed';
    harness.chatRoomId = null;
    const quest = questFixture();
    quest.proposalStatus = 'rejected';
    quest.proposalSlug = 'proposal-1';
    harness.quest = quest;
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="overview"
      />,
    );

    expect(screen.queryByTestId('open-quest-discussion-button')).toBeNull();
    expect(harness.createRoom).not.toHaveBeenCalled();
    expect(harness.openCoherenceChat).not.toHaveBeenCalled();
  });

  it('does not create a room when an accepted quest has none yet', async () => {
    harness.status = 'active';
    harness.chatRoomId = null;
    harness.jwt = 'token';
    const quest = questFixture();
    quest.proposalSlug = 'proposal-1';
    harness.quest = quest;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="overview"
      />,
    );

    fireEvent.click(screen.getByTestId('open-quest-discussion-button'));
    expect(
      await screen.findByText('Discussion could not be opened. Try again.'),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(harness.createRoom).not.toHaveBeenCalled();
    expect(harness.joinRoom).not.toHaveBeenCalled();
    expect(harness.updateAgreementBySlug).not.toHaveBeenCalled();
    expect(harness.openCoherenceChat).not.toHaveBeenCalled();
    expect(harness.openHumanChatPanel).not.toHaveBeenCalled();
  });

  it('joins a quest room provisioned on refresh before creating one', async () => {
    harness.status = 'active';
    harness.chatRoomId = null;
    harness.refreshedRoomId = '!quest:provisioned';
    harness.jwt = 'token';
    const quest = questFixture();
    quest.proposalSlug = 'proposal-1';
    harness.quest = quest;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="overview"
      />,
    );

    fireEvent.click(screen.getByTestId('open-quest-discussion-button'));
    await waitFor(() => {
      expect(harness.openCoherenceChat).toHaveBeenCalledWith(
        '!quest:provisioned',
        'Onboarding',
        'onboarding',
        'Keep the saved goal',
        'sandbox',
        { channel: 'quest' },
      );
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(harness.createRoom).not.toHaveBeenCalled();
    expect(harness.requestQuestChat).not.toHaveBeenCalled();
  });

  it('edits the quest name, participants, and paused health from Settings', async () => {
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="settings"
      />,
    );

    expect(screen.queryByText('Quest health')).toBeNull();
    fireEvent.click(settingsAction('Quest name'));
    expect(
      await screen.findByRole('heading', { name: 'Edit name' }),
    ).toBeTruthy();

    fireEvent.click(settingsAction('Participants'));
    expect(
      await screen.findByRole('heading', { name: 'Edit participants' }),
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

  it('hides the helper from a viewer who cannot edit', async () => {
    harness.personId = 99;
    render(
      <SpaceQuestDetail
        spaceSlug="sandbox"
        questSlug="onboarding"
        tab="settings"
      />,
    );
    expect(screen.queryByTestId('open-quest-helper-button')).toBeNull();
    expect(screen.queryByTestId('open-quest-chat-button')).toBeNull();
    fireEvent.click(screen.getByTestId('open-quest-discussion-button'));
    await waitFor(() => {
      expect(harness.openCoherenceChat).toHaveBeenCalledWith(
        'room-1',
        'Onboarding',
        'onboarding',
        'Keep the saved goal',
        'sandbox',
        { channel: 'quest' },
      );
    });
    expect(harness.openHumanChatPanel).not.toHaveBeenCalled();
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
    expect(overview.textContent).not.toContain(
      'Click a milestone to expand its description.',
    );
  });

  it('keeps the status tag and drops the header health label', () => {
    const quest = questFixture();
    const milestone = quest.milestones[0];
    if (!milestone) throw new Error('expected a milestone');
    milestone.ownerName = 'Ada Lovelace';
    milestone.ownerPersonId = 7;
    harness.quest = quest;
    render(<SpaceQuestDetail spaceSlug="sandbox" questSlug="onboarding" />);

    const header = screen
      .getByRole('heading', { name: 'Onboarding' })
      .closest('header');
    expect(header?.textContent).toContain('Active');
    expect(header?.textContent).not.toMatch(
      /On track|Off track|At risk|Not started/,
    );
    expect(screen.getByTestId('quest-health-label')).toBeTruthy();
    const owner = screen.getByTestId('quest-milestone-owner-1');
    expect(owner.textContent).toContain('Ada Lovelace');
    expect(owner.querySelector('[aria-hidden]')?.textContent).toBe('A');
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
    expect(screen.queryByTestId('open-quest-discussion-button')).toBeNull();
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
