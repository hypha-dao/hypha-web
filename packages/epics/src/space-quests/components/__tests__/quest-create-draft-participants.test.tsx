// @vitest-environment jsdom

import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { ada, saveQuestDraftRequest, getQuestDraftRequest } = vi.hoisted(() => ({
  ada: {
    personId: 9,
    name: 'Ada Lovelace',
    avatarUrl: null as string | null,
    nickname: 'ada',
    person: {
      id: 9,
      name: 'Ada',
      surname: 'Lovelace',
      nickname: 'ada',
      avatarUrl: null as string | null,
    },
  },
  saveQuestDraftRequest: vi.fn().mockResolvedValue({ id: 4 }),
  getQuestDraftRequest: vi.fn(),
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
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) =>
    ((
      {
        'drafts.notSaved': 'Not saved yet',
        'drafts.saving': 'Saving…',
        'drafts.savedAuto': 'Draft saved automatically',
        'drafts.retry': "Couldn't save. Retry",
      } as Record<string, string>
    )[key] ?? key),
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
    getAccessToken: async () => null,
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
      createAgreement: vi.fn(),
      updateAgreementBySlug: vi.fn(),
      agreement: null,
      isPending: false,
      progress: 0,
      currentAction: '',
    }),
    useJwt: () => ({ jwt: null }),
    useMe: () => ({ person: { name: 'Vlad', surname: 'Hramtsov' } }),
    useSpaceBySlug: () => ({ space: { title: 'Sandbox', slug: 'sandbox' } }),
  };
});

vi.mock('../../../common/human-chat-panel-context', () => ({
  useAiPanel: () => ({ closeAiPanel: vi.fn() }),
  useHumanChatPanel: () => ({
    open: false,
    questChatRequested: false,
    panelAvailable: true,
    openHumanChatPanel: vi.fn(),
    closeHumanChatPanel: vi.fn(),
    closeCoherenceChat: vi.fn(),
    requestQuestChat: vi.fn(),
    dismissQuestChat: vi.fn(),
    setSpaceQuestDraft: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-space-quests', () => ({
  useQuestSpaceMembers: () => [ada],
  toQuestSpaceMemberPersons: () => [ada.person],
  findQuestSpaceMember: () => null,
  findQuestSpaceMemberId: () => null,
  createSpaceQuestRequest: vi.fn(),
  deleteSpaceQuestRequest: vi.fn(),
  patchSpaceQuestRequest: vi.fn(),
  getQuestDraftRequest,
  saveQuestDraftRequest,
  deleteQuestDraftRequest: vi.fn().mockResolvedValue(undefined),
}));

import { SpaceQuestCreateDraft } from '../space-quest-create-draft';

function participantCard() {
  return screen.getByTestId('draft-section-members');
}

function chooseAda() {
  fireEvent.click(participantCard());
  fireEvent.change(screen.getByLabelText('Choose or search a participant…'), {
    target: { value: '9' },
  });
}

beforeEach(() => {
  saveQuestDraftRequest.mockClear();
  saveQuestDraftRequest.mockResolvedValue({ id: 4 });
  getQuestDraftRequest.mockReset();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('quest create draft participants', () => {
  it('shows a person chosen in the card editor, autosaves them, and restores the draft', async () => {
    const view = render(<SpaceQuestCreateDraft spaceSlug="sandbox" />);
    expect(participantCard().textContent).toContain('Not set yet');

    await chooseAda();

    await waitFor(() => {
      expect(within(participantCard()).getByText('Ada Lovelace')).toBeTruthy();
    });
    expect(within(participantCard()).queryByText('Not set yet')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(participantCard()).getByText('Ada Lovelace')).toBeTruthy();

    await waitFor(() => {
      expect(saveQuestDraftRequest).toHaveBeenCalled();
    });
    const payload = saveQuestDraftRequest.mock.calls
      .map((call) => call[0]?.payload)
      .find((saved) =>
        saved?.draft?.members?.some(
          (member: { memberName?: string }) =>
            member.memberName === 'Ada Lovelace',
        ),
      );
    expect(payload?.draft.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ memberName: 'Ada Lovelace' }),
      ]),
    );

    view.unmount();
    window.sessionStorage.clear();
    getQuestDraftRequest.mockResolvedValue({
      id: 4,
      name: 'New quest',
      updatedAt: '2026-11-12T00:00:00.000Z',
      payload,
    });
    render(<SpaceQuestCreateDraft spaceSlug="sandbox" resumeDraftId={4} />);

    await waitFor(() => {
      expect(within(participantCard()).getByText('Ada Lovelace')).toBeTruthy();
    });
    expect(within(participantCard()).queryByText('Not set yet')).toBeNull();
  });
});
