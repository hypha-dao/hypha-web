// @vitest-environment jsdom

import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpaceQuestCreateDraft } from '../space-quest-create-draft';
import { questCreateSessionKey } from '../../utils/quest-create-session';

const SPACE = 'sandbox';

const harness = vi.hoisted(() => ({
  createAgreement: vi.fn(),
  updateAgreementBySlug: vi.fn(),
  reset: vi.fn(),
  createSpaceQuestRequest: vi.fn(),
  deleteSpaceQuestRequest: vi.fn(),
  patchSpaceQuestRequest: vi.fn(),
  getQuestDraftRequest: vi.fn(),
  saveQuestDraftRequest: vi.fn(),
  deleteQuestDraftRequest: vi.fn(),
  setSpaceQuestDraft: vi.fn(),
  closeAiPanel: vi.fn(),
  openHumanChatPanel: vi.fn(),
  push: vi.fn(),
  spaceMembers: [] as Array<{
    person: {
      id: number;
      name?: string;
      surname?: string;
      avatarUrl?: string | null;
      nickname?: string | null;
    };
    personId: number;
    name: string;
    avatarUrl: string | null;
    nickname: string | null;
  }>,
}));

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
  useRouter: () => ({ push: harness.push }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

vi.mock('wagmi', () => ({
  useConfig: () => ({}),
}));

vi.mock('@hypha-platform/ui', async () => {
  const actual = await vi.importActual<typeof import('@hypha-platform/ui')>(
    '@hypha-platform/ui',
  );
  return {
    ...actual,
    Combobox: ({
      options,
      onChange,
      placeholder,
    }: {
      options: Array<{ value: string; label?: string }>;
      onChange?: (value: string) => void;
      placeholder?: string;
    }) => (
      <select
        aria-label={placeholder}
        defaultValue=""
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    getAccessToken: async () => 'token',
    user: { id: 'user-1' },
    isLoading: false,
  }),
}));

vi.mock('@hypha-platform/core/client', async () => {
  const actual = await vi.importActual<
    typeof import('@hypha-platform/core/client')
  >('@hypha-platform/core/client');
  return {
    ...actual,
    useCreateAgreementOrchestrator: () => ({
      createAgreement: harness.createAgreement,
      updateAgreementBySlug: harness.updateAgreementBySlug,
      agreement: null,
      isPending: false,
      progress: 0,
      currentAction: '',
      reset: harness.reset,
    }),
    useJwt: () => ({ jwt: 'token' }),
    useMe: () => ({
      person: { id: 7, name: 'Vlad', surname: 'Hramtsov' },
    }),
    useSpaceBySlug: () => ({
      space: { id: 3, title: 'Sandbox', slug: SPACE },
    }),
  };
});

vi.mock('../../../common/human-chat-panel-context', () => ({
  useAiPanel: () => ({ closeAiPanel: harness.closeAiPanel }),
  useHumanChatPanel: () => ({
    open: false,
    panelAvailable: true,
    openHumanChatPanel: harness.openHumanChatPanel,
    closeHumanChatPanel: vi.fn(),
    closeCoherenceChat: vi.fn(),
    requestQuestChat: vi.fn(),
    dismissQuestChat: vi.fn(),
    setSpaceQuestDraft: harness.setSpaceQuestDraft,
  }),
}));

vi.mock('../../hooks/use-space-quests', () => ({
  useQuestSpaceMembers: () => harness.spaceMembers,
  toQuestSpaceMemberPersons: (
    members: Array<{
      person?: {
        id: number;
        name?: string;
        surname?: string;
        avatarUrl?: string | null;
        nickname?: string | null;
      };
      personId: number;
      name: string;
      avatarUrl: string | null;
      nickname: string | null;
    }>,
  ) =>
    members.map((member) =>
      member.person?.name
        ? member.person
        : {
            id: member.personId,
            name: member.name,
            surname: '',
            avatarUrl: member.avatarUrl,
            nickname: member.nickname,
          },
    ),
  findQuestSpaceMember: () => null,
  findQuestSpaceMemberId: () => null,
  createSpaceQuestRequest: harness.createSpaceQuestRequest,
  deleteSpaceQuestRequest: harness.deleteSpaceQuestRequest,
  patchSpaceQuestRequest: harness.patchSpaceQuestRequest,
  getQuestDraftRequest: harness.getQuestDraftRequest,
  saveQuestDraftRequest: harness.saveQuestDraftRequest,
  deleteQuestDraftRequest: harness.deleteQuestDraftRequest,
}));

function emptyDraft(overrides: Record<string, unknown> = {}) {
  return {
    name: '',
    goal: '',
    scopeIn: [],
    scopeOut: [],
    scopeInMarkdown: '',
    scopeOutMarkdown: '',
    successCriteria: '',
    rewards: [],
    milestones: [],
    leadName: 'Vlad Hramtsov (you)',
    selectedLeadPersonId: 7,
    members: [],
    targetDate: '2026-01-01',
    ...overrides,
  };
}

function seedSession(draftId: number | null = 4) {
  window.sessionStorage.setItem(
    questCreateSessionKey(SPACE),
    JSON.stringify({
      draft: emptyDraft({
        name: 'Quest test',
        goal: 'Verify that the quest flow works end-to-end.',
        scopeIn: ['Create the quest in this sandbox'],
      }),
      messages: [
        {
          id: 'helper-1',
          role: 'member',
          senderName: 'Quest Helper',
          text: 'Should Grok Test be listed as a participant?',
          timestamp: '2026-11-09T20:00:00.000Z',
        },
        {
          id: 'user-1',
          role: 'user',
          text: 'yes',
          timestamp: '2026-11-09T20:01:00.000Z',
        },
      ],
      step: 4,
      pending: null,
      checkpoint: null,
      draftId,
    }),
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  harness.createAgreement.mockReset();
  harness.updateAgreementBySlug.mockReset();
  harness.reset.mockReset();
  harness.createSpaceQuestRequest.mockReset();
  harness.deleteSpaceQuestRequest.mockReset();
  harness.patchSpaceQuestRequest.mockReset();
  harness.getQuestDraftRequest.mockReset();
  harness.saveQuestDraftRequest.mockReset();
  harness.deleteQuestDraftRequest.mockReset();
  harness.setSpaceQuestDraft.mockReset();
  harness.push.mockReset();
  harness.spaceMembers = [];
  harness.createSpaceQuestRequest.mockResolvedValue({
    slug: 'quest-test',
    name: 'Quest test',
    goal: 'Verify that the quest flow works end-to-end.',
    scopeIn: ['Create the quest in this sandbox'],
    scopeOut: [],
    scopeInMarkdown: '',
    scopeOutMarkdown: '',
    successCriteria: '',
    rewards: [],
    targetDate: '2026-01-01',
    leadName: 'Vlad Hramtsov',
    milestones: [],
    members: [
      {
        order: 0,
        personId: 7,
        memberName: 'Vlad Hramtsov',
        roleLabel: 'Lead',
        responsibilities: ['Overall delivery'],
      },
    ],
  });
  harness.deleteSpaceQuestRequest.mockResolvedValue(undefined);
  harness.patchSpaceQuestRequest.mockResolvedValue(undefined);
  harness.updateAgreementBySlug.mockResolvedValue(undefined);
  harness.deleteQuestDraftRequest.mockResolvedValue(undefined);
  harness.saveQuestDraftRequest.mockImplementation(
    async ({ id }: { id?: number | null }) => ({
      id: id ?? 4,
      name: 'Quest test',
      updatedAt: '2026-11-09T20:02:00.000Z',
      payload: {},
    }),
  );
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('quest create draft persistence', () => {
  it('loads a server draft, including the helper thread', async () => {
    harness.getQuestDraftRequest.mockResolvedValue({
      id: 9,
      name: 'Late checklist',
      updatedAt: '2026-11-09T21:00:00.000Z',
      payload: {
        draft: emptyDraft({
          name: 'Late checklist',
          goal: 'Finish the checklist',
        }),
        messages: [
          {
            id: 'h1',
            role: 'member',
            senderName: 'Quest Helper',
            text: 'What should the goal be?',
            timestamp: '2026-11-09T21:00:00.000Z',
          },
          {
            id: 'u1',
            role: 'user',
            text: 'Ship the checklist',
            timestamp: '2026-11-09T21:01:00.000Z',
          },
        ],
        step: 1,
        pending: null,
      },
    });

    render(<SpaceQuestCreateDraft spaceSlug={SPACE} resumeDraftId={9} />);

    expect(
      (await screen.findByTestId('draft-section-name')).textContent,
    ).toContain('Late checklist');
    expect(screen.getByText('Finish the checklist')).toBeTruthy();
    await waitFor(() => {
      const latest = harness.setSpaceQuestDraft.mock.calls.at(-1)?.[0];
      expect(
        latest?.messages.map((message: { text: string }) => message.text),
      ).toEqual(['What should the goal be?', 'Ship the checklist']);
    });
    const stored = JSON.parse(
      window.sessionStorage.getItem(questCreateSessionKey(SPACE)) ?? '{}',
    );
    expect(stored.draftId).toBe(9);
  });

  it('starts blank from New Quest and leaves the previous server draft alone', async () => {
    seedSession(4);
    render(<SpaceQuestCreateDraft spaceSlug={SPACE} startFresh />);

    expect(screen.queryByText('Quest test')).toBeNull();
    expect(
      window.sessionStorage.getItem(questCreateSessionKey(SPACE)),
    ).toBeNull();
    expect(harness.deleteQuestDraftRequest).not.toHaveBeenCalled();
  });

  it('asks to keep or discard on cancel', async () => {
    seedSession(4);
    render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
    expect(
      (await screen.findByTestId('draft-section-name')).textContent,
    ).toContain('Quest test');

    fireEvent.click(screen.getByTestId('cancel-quest-button'));
    fireEvent.click(screen.getByTestId('keep-quest-draft-button'));

    await waitFor(() => {
      expect(harness.saveQuestDraftRequest).toHaveBeenCalledWith(
        expect.objectContaining({ spaceSlug: SPACE, id: 4 }),
      );
      expect(harness.push).toHaveBeenCalledWith('/en/dho/sandbox/quests');
    });
  });

  it('discards the server draft and the local session', async () => {
    seedSession(4);
    render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
    expect(
      (await screen.findByTestId('draft-section-name')).textContent,
    ).toContain('Quest test');

    fireEvent.click(screen.getByTestId('cancel-quest-button'));
    fireEvent.click(screen.getByTestId('discard-quest-draft-button'));

    await waitFor(() => {
      expect(harness.deleteQuestDraftRequest).toHaveBeenCalledWith(
        expect.objectContaining({ spaceSlug: SPACE, draftId: 4 }),
      );
      expect(harness.push).toHaveBeenCalledWith('/en/dho/sandbox/quests');
    });
    expect(
      window.sessionStorage.getItem(questCreateSessionKey(SPACE)),
    ).toBeNull();
  });

  it('removes the server draft once the quest proposal exists', async () => {
    seedSession(4);
    harness.createAgreement.mockResolvedValue({
      id: 44,
      slug: 'quest-test-proposal',
    });
    render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
    expect(
      (await screen.findByTestId('draft-section-name')).textContent,
    ).toContain('Quest test');

    await waitFor(() => {
      expect(
        (screen.getByTestId('create-quest-button') as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
    fireEvent.click(screen.getByTestId('create-quest-button'));
    fireEvent.click(screen.getByTestId('confirm-create-proposal-button'));

    await waitFor(() => {
      expect(harness.deleteQuestDraftRequest).toHaveBeenCalledWith(
        expect.objectContaining({ spaceSlug: SPACE, draftId: 4 }),
      );
    });
    const stored = JSON.parse(
      window.sessionStorage.getItem(questCreateSessionKey(SPACE)) ?? '{}',
    );
    expect(stored.draftId).toBeNull();
    expect(stored.checkpoint.agreementId).toBe(44);
  });

  it('does not save a member parsed from an either/or helper question', async () => {
    const pendingGoal = 'Ship a shorter goal the member has not confirmed.';
    const savedGoal = 'The goal already on the card.';
    const transcript =
      'Grok Test is on the roster… Should Vlad Hramtsov stay the Lead only, or be listed as a participant as well?';
    window.sessionStorage.setItem(
      questCreateSessionKey(SPACE),
      JSON.stringify({
        draft: emptyDraft({
          name: 'Quest test',
          goal: savedGoal,
        }),
        messages: [
          {
            id: 'goal-1',
            role: 'member',
            senderName: 'Quest Helper',
            text: `Do you want that to be in the Goal?\n\n${pendingGoal}`,
            timestamp: '2026-11-09T20:00:00.000Z',
          },
          {
            id: 'person-1',
            role: 'member',
            senderName: 'Quest Helper',
            text: transcript,
            timestamp: '2026-11-09T20:01:00.000Z',
          },
        ],
        step: 0,
        pending: { step: 'goal', patch: { goal: pendingGoal } },
        checkpoint: null,
        draftId: 4,
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Added that to the Participants.',
        helper: {
          suggestion: null,
          saved: {
            step: 'members',
            source: 'shown',
            patch: { members: [{ memberName: 'or' }] },
          },
          discarded: true,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const view = render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
      expect(await screen.findByText(savedGoal)).toBeTruthy();
      expect(screen.getByTestId('draft-section-members').textContent).toContain(
        'Not set yet',
      );

      const session = () =>
        harness.setSpaceQuestDraft.mock.calls.at(-1)?.[0] as
          | {
              input: string;
              messages?: { text: string }[];
              onInputChange: (value: string) => void;
              onSend: () => void;
            }
          | null
          | undefined;
      await waitFor(() => {
        expect(session()?.onSend).toEqual(expect.any(Function));
      });
      session()?.onInputChange('yes');
      await waitFor(() => {
        expect(session()?.input).toBe('yes');
      });
      session()?.onSend();

      await waitFor(() => {
        const texts = session()?.messages?.map((message) => message.text) ?? [];
        expect(
          texts.some((text) =>
            text.includes('Which space member should I add as a participant?'),
          ),
        ).toBe(true);
      });
      const membersCard = screen.getByTestId(
        'draft-section-members',
      ).textContent;
      expect(membersCard).toContain('Not set yet');
      expect(membersCard).not.toContain('Grok Test');
      expect(membersCard).not.toContain('Vlad Hramtsov');
      expect(screen.getByTestId('draft-section-goal').textContent).toContain(
        savedGoal,
      );
      expect(
        screen.getByTestId('draft-section-goal').textContent,
      ).not.toContain(pendingGoal);

      await waitFor(
        () => {
          expect(harness.saveQuestDraftRequest).toHaveBeenCalled();
        },
        { timeout: 4000 },
      );
      const payloads = harness.saveQuestDraftRequest.mock.calls.map(
        (call) => call[0]?.payload,
      );
      for (const saved of payloads) {
        const names =
          saved?.draft?.members?.map(
            (member: { memberName?: string }) => member.memberName,
          ) ?? [];
        expect(names).not.toContain('or');
        expect(names).not.toContain('Grok Test');
        expect(names).not.toContain('Vlad Hramtsov');
        expect(saved?.draft?.goal).toBe(savedGoal);
      }

      const payload = payloads.at(-1);
      view.unmount();
      window.sessionStorage.clear();
      harness.getQuestDraftRequest.mockResolvedValue({
        id: 4,
        name: 'Quest test',
        updatedAt: '2026-11-12T00:00:00.000Z',
        payload,
      });
      render(<SpaceQuestCreateDraft spaceSlug={SPACE} resumeDraftId={4} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('draft-section-members').textContent,
        ).toContain('Not set yet');
      });
      const restored = screen.getByTestId('draft-section-members').textContent;
      expect(restored).not.toContain('Grok Test');
      expect(screen.getByTestId('draft-section-goal').textContent).toContain(
        savedGoal,
      );
      expect(
        screen.getByTestId('draft-section-goal').textContent,
      ).not.toContain(pendingGoal);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('saves a yes for the latest roster member after an earlier either/or turn', async () => {
    const pendingGoal =
      'Goal card is up for you to confirm, nothing is written yet';
    const savedGoal = 'The goal already on the card.';
    harness.spaceMembers = [
      {
        person: { id: 7 },
        personId: 7,
        name: 'Vlad Hramtsov',
        avatarUrl: null,
        nickname: 'vlad',
      },
      {
        person: { id: 8 },
        personId: 8,
        name: 'Grok Test',
        avatarUrl: null,
        nickname: null,
      },
    ];
    window.sessionStorage.setItem(
      questCreateSessionKey(SPACE),
      JSON.stringify({
        draft: emptyDraft({
          name: 'Quest test',
          goal: savedGoal,
        }),
        messages: [
          {
            id: 'either-1',
            role: 'member',
            senderName: 'Quest Helper',
            text: 'Grok Test is on the roster… Should Vlad Hramtsov stay the Lead only, or be listed as a participant as well?',
            timestamp: '2026-11-09T20:00:00.000Z',
          },
          {
            id: 'goal-1',
            role: 'member',
            senderName: 'Quest Helper',
            text: pendingGoal,
            timestamp: '2026-11-09T20:01:00.000Z',
          },
          {
            id: 'person-1',
            role: 'member',
            senderName: 'Quest Helper',
            text: 'Participants card is up for Grok Test, and your goal wording stays unsaved',
            timestamp: '2026-11-09T20:02:00.000Z',
          },
        ],
        step: 0,
        pending: { step: 'goal', patch: { goal: pendingGoal } },
        checkpoint: null,
        draftId: 4,
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Which space member should I add as a participant?',
        helper: {
          suggestion: null,
          saved: {
            step: 'members',
            source: 'shown',
            patch: { members: [{ memberName: 'or' }] },
          },
          discarded: true,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const view = render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
      expect(await screen.findByText(savedGoal)).toBeTruthy();

      const session = () =>
        harness.setSpaceQuestDraft.mock.calls.at(-1)?.[0] as
          | {
              input: string;
              onInputChange: (value: string) => void;
              onSend: () => void;
            }
          | null
          | undefined;
      await waitFor(() => {
        expect(session()?.onSend).toEqual(expect.any(Function));
      });
      session()?.onInputChange('yes');
      await waitFor(() => {
        expect(session()?.input).toBe('yes');
      });
      session()?.onSend();

      await waitFor(() => {
        expect(
          screen.getByTestId('draft-section-members').textContent,
        ).toContain('Grok Test');
      });
      const membersCard = screen.getByTestId(
        'draft-section-members',
      ).textContent;
      expect(membersCard).not.toContain('Vlad Hramtsov');
      expect(screen.getByTestId('draft-section-goal').textContent).toContain(
        savedGoal,
      );
      expect(
        screen.getByTestId('draft-section-goal').textContent,
      ).not.toContain(pendingGoal);

      let payload:
        | {
            draft: {
              goal: string;
              members: Array<{ memberName?: string; personId?: number }>;
            };
          }
        | undefined;
      await waitFor(
        () => {
          payload = harness.saveQuestDraftRequest.mock.calls
            .map((call) => call[0]?.payload)
            .find((saved) =>
              saved?.draft?.members?.some(
                (member: { memberName?: string }) =>
                  member.memberName === 'Grok Test',
              ),
            );
          expect(payload?.draft.goal).toBe(savedGoal);
          expect(payload?.draft.members).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                memberName: 'Grok Test',
                personId: 8,
              }),
            ]),
          );
        },
        { timeout: 4000 },
      );
      expect(
        payload?.draft.members.some(
          (member) =>
            member.memberName === 'or' || member.memberName === 'Vlad Hramtsov',
        ),
      ).toBe(false);

      view.unmount();
      window.sessionStorage.clear();
      harness.getQuestDraftRequest.mockResolvedValue({
        id: 4,
        name: 'Quest test',
        updatedAt: '2026-11-12T00:00:00.000Z',
        payload,
      });
      render(<SpaceQuestCreateDraft spaceSlug={SPACE} resumeDraftId={4} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('draft-section-members').textContent,
        ).toContain('Grok Test');
      });
      expect(screen.getByTestId('draft-section-goal').textContent).toContain(
        savedGoal,
      );
    } finally {
      vi.unstubAllGlobals();
      harness.spaceMembers = [];
    }
  });

  it('keeps create proposal disabled when only the title is set', async () => {
    render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
    const button = screen.getByTestId(
      'create-quest-button',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByTestId('create-proposal-requirement').textContent).toBe(
      'drafts.needTitleAndGoal',
    );

    fireEvent.click(screen.getByTestId('draft-section-name'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Onboarding matcher'), {
      target: { value: 'Sandbox quest' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByTestId('draft-section-name').textContent).toContain(
        'Sandbox quest',
      );
    });
    expect(screen.getByTestId('draft-section-goal').textContent).toContain(
      'Not set yet',
    );
    expect(button.disabled).toBe(true);
    expect(screen.getByTestId('create-proposal-requirement')).toBeTruthy();
  });

  it('persists a Title card edit through autosave and reload', async () => {
    const view = render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
    fireEvent.click(screen.getByTestId('draft-section-name'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Onboarding matcher'), {
      target: { value: 'Sandbox quest' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(
      () => {
        expect(harness.saveQuestDraftRequest).toHaveBeenCalled();
      },
      { timeout: 4000 },
    );
    const payload =
      harness.saveQuestDraftRequest.mock.calls.at(-1)?.[0]?.payload;
    expect(payload?.draft?.name).toBe('Sandbox quest');

    view.unmount();
    window.sessionStorage.clear();
    harness.getQuestDraftRequest.mockResolvedValue({
      id: 4,
      name: 'Sandbox quest',
      updatedAt: '2026-11-12T00:00:00.000Z',
      payload,
    });
    render(<SpaceQuestCreateDraft spaceSlug={SPACE} resumeDraftId={4} />);

    expect(
      (await screen.findByTestId('draft-section-name')).textContent,
    ).toContain('Sandbox quest');
    expect(screen.getByRole('heading', { name: 'New quest' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Quest title' })).toBeNull();
  });

  it('enables create proposal only after both the title and the goal are set', async () => {
    harness.spaceMembers = [
      {
        person: { id: 8, name: 'Grok Test', surname: '' },
        personId: 8,
        name: 'Grok Test',
        avatarUrl: null,
        nickname: null,
      },
    ];
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
    if (!('ResizeObserver' in globalThis)) {
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      vi.stubGlobal('ResizeObserver', ResizeObserver);
    }

    const createButton = () =>
      screen.getByTestId('create-quest-button') as HTMLButtonElement;
    const requirement = () =>
      screen.queryByTestId('create-proposal-requirement');
    const insertEditor = (text: string, index = 0) => {
      const editor = screen.getAllByRole('textbox', {
        name: 'Rich text editor',
      })[index] as HTMLElement & {
        editor?: { commands: { insertContent: (value: string) => boolean } };
      };
      expect(editor?.editor).toBeTruthy();
      editor.editor?.commands.insertContent(text);
    };
    const saveDialog = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    };
    const saveEditor = async (text: string, index = 0) => {
      insertEditor(text, index);
      await waitFor(() => {
        expect(
          screen.getAllByRole('textbox', { name: 'Rich text editor' })[index]
            ?.textContent,
        ).toContain(text);
      });
      await saveDialog();
    };

    render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
    expect(createButton().disabled).toBe(true);
    expect(screen.getByRole('heading', { name: 'New quest' })).toBeTruthy();
    expect(requirement()?.textContent).toBe('drafts.needTitleAndGoal');
    expect(screen.queryByText(/too long to publish/i)).toBeNull();

    fireEvent.click(screen.getByTestId('draft-section-goal'));
    await saveEditor('test2');
    expect(screen.getByTestId('draft-section-goal').textContent).toContain(
      'test2',
    );
    expect(createButton().disabled).toBe(true);
    expect(requirement()).toBeTruthy();

    fireEvent.click(screen.getByTestId('draft-section-name'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Onboarding matcher'), {
      target: { value: 'Sandbox quest' },
    });
    await saveDialog();
    expect(createButton().disabled).toBe(false);
    expect(screen.getByTestId('draft-section-name').textContent).toContain(
      'Sandbox quest',
    );
    expect(requirement()).toBeNull();

    fireEvent.click(screen.getByTestId('draft-section-scope'));
    await saveEditor('234');
    expect(screen.getByTestId('draft-section-scope').textContent).toContain(
      '234',
    );

    fireEvent.click(screen.getByTestId('draft-section-success'));
    await saveEditor('234');
    expect(screen.getByTestId('draft-section-success').textContent).toContain(
      '234',
    );

    fireEvent.click(screen.getByTestId('add-reward-token-button'));
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '234' },
    });
    expect(screen.getByTestId('draft-section-rewards').textContent).toContain(
      'USDC',
    );

    fireEvent.click(screen.getByTestId('draft-section-members'));
    fireEvent.change(screen.getByLabelText('Choose or search a participant…'), {
      target: { value: '8' },
    });
    await saveDialog();
    expect(screen.getByTestId('draft-section-members').textContent).toContain(
      'Grok Test',
    );

    fireEvent.click(screen.getByTestId('draft-section-target-date'));
    fireEvent.click(screen.getByRole('button', { name: '20 November 2026' }));
    const day = document.querySelector(
      '[data-quest-date-popover] button[aria-label*="November 13"]',
    );
    expect(day).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(day as HTMLButtonElement);
    await saveDialog();

    fireEvent.click(screen.getByTestId('draft-section-milestones'));
    fireEvent.click(screen.getByTestId('add-milestone-at-end'));
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Draft review with stewards'),
      { target: { value: 'M1' } },
    );
    await saveDialog();
    expect(
      screen.getByTestId('draft-section-milestones').textContent,
    ).toContain('M1');

    expect(screen.getByRole('heading', { name: 'New quest' })).toBeTruthy();
    expect(screen.getByTestId('draft-section-name').textContent).toContain(
      'Sandbox quest',
    );
    expect(createButton().disabled).toBe(false);
    expect(screen.queryByText(/too long to publish/i)).toBeNull();
    fireEvent.click(createButton());
    expect(
      (
        screen.getByTestId(
          'confirm-create-proposal-button',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it('discards Cancel on every create card and reloads the saved draft', async () => {
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
    if (!('ResizeObserver' in globalThis)) {
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      vi.stubGlobal('ResizeObserver', ResizeObserver);
    }
    harness.spaceMembers = [
      {
        person: { id: 7, name: 'Vlad', surname: 'Hramtsov' },
        personId: 7,
        name: 'Vlad Hramtsov',
        avatarUrl: null,
        nickname: null,
      },
      {
        person: { id: 8, name: 'Grok Test', surname: '' },
        personId: 8,
        name: 'Grok Test',
        avatarUrl: null,
        nickname: null,
      },
    ];
    const original = emptyDraft({
      name: 'Sandbox quest',
      goal: 'Ship the checklist',
      scopeIn: ['In the sandbox'],
      scopeInMarkdown: 'In the sandbox',
      successCriteria: 'A recorded pass',
      rewards: [{ amount: '234', token: 'USDC' }],
      milestones: [
        {
          name: 'Draft the brief',
          description: '',
          dueDate: null,
          ownerName: null,
          status: 'not_started',
        },
      ],
      leadName: 'Vlad Hramtsov',
      selectedLeadPersonId: 7,
      members: [
        {
          personId: 8,
          memberName: 'Grok Test',
          roleLabel: null,
          responsibilities: ['Own the notes'],
        },
      ],
      targetDate: '2026-11-20',
    });
    const saved = {
      id: 9,
      name: 'Sandbox quest',
      updatedAt: '2026-11-12T00:00:00.000Z',
      payload: {
        draft: original,
        messages: [],
        step: 1,
        pending: null,
      },
    };
    harness.getQuestDraftRequest.mockResolvedValue(saved);

    const view = render(
      <SpaceQuestCreateDraft spaceSlug={SPACE} resumeDraftId={9} />,
    );
    expect(
      (await screen.findByTestId('draft-section-name')).textContent,
    ).toContain('Sandbox quest');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
    });
    const savesBeforeEdit = harness.saveQuestDraftRequest.mock.calls.length;

    const insertEditor = (text: string) => {
      const editor = screen.getAllByRole('textbox', {
        name: 'Rich text editor',
      })[0] as HTMLElement & {
        editor?: { commands: { insertContent: (value: string) => boolean } };
      };
      expect(editor?.editor).toBeTruthy();
      editor.editor?.commands.insertContent(text);
    };
    const cancel = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).toBeNull();
    };

    fireEvent.click(screen.getByTestId('draft-section-name'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Onboarding matcher'), {
      target: { value: '' },
    });
    cancel();

    fireEvent.click(screen.getByTestId('draft-section-goal'));
    insertEditor('LEAKED GOAL');
    cancel();

    fireEvent.click(screen.getByTestId('draft-section-scope'));
    insertEditor('LEAKED SCOPE');
    cancel();

    fireEvent.click(screen.getByTestId('draft-section-success'));
    insertEditor('LEAKED SUCCESS');
    cancel();

    fireEvent.click(screen.getByRole('button', { name: 'Edit quest reward' }));
    fireEvent.change(
      within(screen.getByRole('dialog')).getByDisplayValue('234'),
      {
        target: { value: '999' },
      },
    );
    cancel();

    fireEvent.click(screen.getByTestId('draft-section-milestones'));
    fireEvent.change(screen.getByDisplayValue('Draft the brief'), {
      target: { value: 'Leaked milestone' },
    });
    cancel();

    fireEvent.click(screen.getByTestId('draft-section-members'));
    fireEvent.change(screen.getByTestId('quest-participant-role-0'), {
      target: { value: 'Scribe' },
    });
    cancel();

    fireEvent.click(screen.getByTestId('draft-section-lead'));
    fireEvent.change(screen.getByLabelText('Select a participant…'), {
      target: { value: '8' },
    });
    cancel();

    fireEvent.click(screen.getByTestId('draft-section-target-date'));
    fireEvent.click(screen.getByRole('button', { name: '20 November 2026' }));
    const day = document.querySelector(
      '[data-quest-date-popover] button[aria-label*="November 13"]',
    );
    expect(day).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(day as HTMLButtonElement);
    cancel();

    const page = document.body.textContent ?? '';
    expect(screen.getByTestId('draft-section-name').textContent).toContain(
      'Sandbox quest',
    );
    expect(screen.getByTestId('draft-section-goal').textContent).toContain(
      'Ship the checklist',
    );
    expect(screen.getByTestId('draft-section-goal').textContent).not.toContain(
      'LEAKED GOAL',
    );
    expect(screen.getByTestId('draft-section-scope').textContent).toContain(
      'In the sandbox',
    );
    expect(screen.getByTestId('draft-section-scope').textContent).not.toContain(
      'LEAKED SCOPE',
    );
    expect(screen.getByTestId('draft-section-success').textContent).toContain(
      'A recorded pass',
    );
    expect(
      screen.getByTestId('draft-section-success').textContent,
    ).not.toContain('LEAKED SUCCESS');
    expect(screen.getByTestId('draft-section-rewards').textContent).toContain(
      'USDC',
    );
    expect(
      within(screen.getByTestId('draft-section-rewards')).getByDisplayValue(
        '234',
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('draft-section-rewards')).queryByDisplayValue(
        '999',
      ),
    ).toBeNull();
    expect(
      screen.getByTestId('draft-section-milestones').textContent,
    ).toContain('Draft the brief');
    expect(
      screen.getByTestId('draft-section-milestones').textContent,
    ).not.toContain('Leaked milestone');
    expect(screen.getByTestId('draft-section-members').textContent).toContain(
      'Grok Test',
    );
    expect(screen.getByTestId('draft-section-members').textContent).toContain(
      'Own the notes',
    );
    expect(
      screen.getByTestId('draft-section-members').textContent,
    ).not.toContain('Scribe');
    expect(screen.getByTestId('draft-section-lead').textContent).toContain(
      'Vlad Hramtsov',
    );
    expect(screen.getByTestId('draft-section-lead').textContent).not.toContain(
      'Grok Test',
    );
    expect(
      screen.getByTestId('draft-section-target-date').textContent,
    ).toContain('20 November 2026');
    expect(
      screen.getByTestId('draft-section-target-date').textContent,
    ).not.toContain('13 November 2026');
    expect(page).not.toContain('LEAKED GOAL');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    expect(harness.saveQuestDraftRequest.mock.calls.length).toBe(
      savesBeforeEdit,
    );

    view.unmount();
    window.sessionStorage.clear();
    harness.getQuestDraftRequest.mockResolvedValue(saved);
    render(<SpaceQuestCreateDraft spaceSlug={SPACE} resumeDraftId={9} />);
    expect(
      (await screen.findByTestId('draft-section-name')).textContent,
    ).toContain('Sandbox quest');
    expect(screen.getByTestId('draft-section-goal').textContent).toContain(
      'Ship the checklist',
    );
    expect(screen.getByTestId('draft-section-scope').textContent).toContain(
      'In the sandbox',
    );
    expect(screen.getByTestId('draft-section-success').textContent).toContain(
      'A recorded pass',
    );
    expect(
      within(screen.getByTestId('draft-section-rewards')).getByDisplayValue(
        '234',
      ),
    ).toBeTruthy();
    expect(
      screen.getByTestId('draft-section-milestones').textContent,
    ).toContain('Draft the brief');
    expect(screen.getByTestId('draft-section-members').textContent).toContain(
      'Grok Test',
    );
    expect(screen.getByTestId('draft-section-lead').textContent).toContain(
      'Vlad Hramtsov',
    );
    expect(
      screen.getByTestId('draft-section-target-date').textContent,
    ).toContain('20 November 2026');
  });
});
