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
import { StaleDeploymentError } from '@hypha-platform/core/client';
import { SpaceQuestCreateDraft } from '../space-quest-create-draft';
import { questCreateSessionKey } from '../../utils/quest-create-session';

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
  agreement: null as { slug?: string; proposalId?: number } | null,
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

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    getAccessToken: async () => 'token',
    user: null,
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
      agreement: harness.agreement,
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
      space: { id: 3, title: 'Sandbox', slug: 'sandbox' },
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
  useQuestSpaceMembers: () => [],
  toQuestSpaceMemberPersons: () => [],
  findQuestSpaceMember: () => null,
  findQuestSpaceMemberId: () => null,
  createSpaceQuestRequest: harness.createSpaceQuestRequest,
  deleteSpaceQuestRequest: harness.deleteSpaceQuestRequest,
  patchSpaceQuestRequest: harness.patchSpaceQuestRequest,
  getQuestDraftRequest: harness.getQuestDraftRequest,
  saveQuestDraftRequest: harness.saveQuestDraftRequest,
  deleteQuestDraftRequest: harness.deleteQuestDraftRequest,
}));

const SPACE = 'myspace-stale-oa-20261027-1059';

function seedDraft() {
  window.sessionStorage.setItem(
    questCreateSessionKey(SPACE),
    JSON.stringify({
      draft: {
        name: 'Quest test',
        goal: 'Verify that the quest flow works end-to-end.',
        scopeIn: ['Create the quest in this sandbox'],
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
      },
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
    }),
  );
}

function savedQuest() {
  return {
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
  };
}

async function confirmCreate() {
  await waitFor(() => {
    expect(
      (screen.getByTestId('create-quest-button') as HTMLButtonElement).disabled,
    ).toBe(false);
  });
  fireEvent.click(screen.getByTestId('create-quest-button'));
  fireEvent.click(screen.getByTestId('confirm-create-proposal-button'));
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
  harness.agreement = null;
  harness.createSpaceQuestRequest.mockResolvedValue(savedQuest());
  harness.deleteSpaceQuestRequest.mockResolvedValue(undefined);
  harness.patchSpaceQuestRequest.mockResolvedValue(undefined);
  harness.saveQuestDraftRequest.mockResolvedValue({
    id: 1,
    name: 'Quest test',
    updatedAt: '2026-11-09T20:02:00.000Z',
    payload: {},
  });
  harness.deleteQuestDraftRequest.mockResolvedValue(undefined);
  harness.updateAgreementBySlug.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('quest create after a replaced deploy', () => {
  it('keeps the draft and helper history and drops the quest when the action never ran', async () => {
    seedDraft();
    harness.createAgreement.mockRejectedValue(
      new Error(
        'Server Action "60967ca92bbb289600c8c9651e2f62137cd7bf1011" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action',
      ),
    );
    render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);

    expect(
      (await screen.findByTestId('draft-section-name')).textContent,
    ).toContain('Quest test');
    expect(
      screen.getByText('Verify that the quest flow works end-to-end.'),
    ).toBeTruthy();
    await waitFor(() => {
      const latest = harness.setSpaceQuestDraft.mock.calls.at(-1)?.[0];
      expect(
        latest?.messages.map((message: { text: string }) => message.text),
      ).toEqual(['Should Grok Test be listed as a participant?', 'yes']);
    });

    await confirmCreate();

    expect(
      await screen.findByText(
        'A new version of Hypha was deployed. Reload to continue. Your draft is kept.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(screen.queryByText(/was not found on the server/)).toBeNull();
    expect(harness.reset).toHaveBeenCalled();
    expect(harness.deleteSpaceQuestRequest).toHaveBeenCalledWith(
      expect.objectContaining({ questSlug: 'quest-test' }),
    );

    const stored = JSON.parse(
      window.sessionStorage.getItem(questCreateSessionKey(SPACE)) ?? '{}',
    );
    expect(stored.draft.name).toBe('Quest test');
    expect(stored.draft.goal).toContain('end-to-end');
    expect(
      stored.messages.map((message: { text: string }) => message.text),
    ).toEqual(['Should Grok Test be listed as a participant?', 'yes']);
    expect(stored.checkpoint).toBeNull();
  });

  it('keeps the quest and agreement when the Web2 step already returned an id', async () => {
    seedDraft();
    harness.createAgreement.mockRejectedValue(
      new StaleDeploymentError({ id: 44, slug: 'quest-test-proposal' }),
    );
    render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
    await screen.findByTestId('draft-section-name');
    await confirmCreate();

    expect(
      await screen.findByText(
        'A new version of Hypha was deployed. Reload to continue. Your draft is kept.',
      ),
    ).toBeTruthy();
    expect(harness.deleteSpaceQuestRequest).not.toHaveBeenCalled();
    const stored = JSON.parse(
      window.sessionStorage.getItem(questCreateSessionKey(SPACE)) ?? '{}',
    );
    expect(stored.checkpoint).toEqual({
      questSlug: 'quest-test',
      agreementId: 44,
      agreementSlug: 'quest-test-proposal',
      proposalTitle: 'Quest test',
    });
  });

  it('retries only the link after reload when the agreement already exists', async () => {
    seedDraft();
    const stored = JSON.parse(
      window.sessionStorage.getItem(questCreateSessionKey(SPACE)) ?? '{}',
    );
    stored.checkpoint = {
      questSlug: 'quest-test',
      agreementId: 44,
      agreementSlug: 'quest-test-proposal',
      proposalTitle: 'Quest test',
    };
    window.sessionStorage.setItem(
      questCreateSessionKey(SPACE),
      JSON.stringify(stored),
    );
    harness.agreement = { slug: 'quest-test-proposal', proposalId: 9 };

    render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
    await screen.findByTestId('draft-section-name');
    await confirmCreate();

    await waitFor(() => {
      expect(harness.patchSpaceQuestRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          questSlug: 'quest-test',
          patch: { proposalDocumentId: 44 },
        }),
      );
    });
    expect(harness.createSpaceQuestRequest).not.toHaveBeenCalled();
    expect(harness.createAgreement).not.toHaveBeenCalled();
    expect(harness.updateAgreementBySlug).toHaveBeenCalledWith({
      slug: 'quest-test-proposal',
      web3ProposalId: 9,
    });
    expect(harness.push).toHaveBeenCalledWith(
      '/en/dho/myspace-stale-oa-20261027-1059/agreements/proposal/quest-test-proposal',
    );
  });

  it('still shows an ordinary failure without asking for a reload', async () => {
    seedDraft();
    harness.createAgreement.mockRejectedValue(new Error('wallet rejected'));
    render(<SpaceQuestCreateDraft spaceSlug={SPACE} />);
    await screen.findByTestId('draft-section-name');
    await confirmCreate();

    expect(await screen.findByText('wallet rejected')).toBeTruthy();
    expect(
      screen.queryByText(/A new version of Hypha was deployed/),
    ).toBeNull();
    expect(harness.deleteSpaceQuestRequest).toHaveBeenCalled();
  });
});
