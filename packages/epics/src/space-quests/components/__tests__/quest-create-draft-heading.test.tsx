// @vitest-environment jsdom

import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestQuestChat } = vi.hoisted(() => ({
  requestQuestChat: vi.fn(),
}));

import { SpaceQuestCreateDraft } from '../space-quest-create-draft';
import {
  getQuestDraftRequest,
  saveQuestDraftRequest,
} from '../../hooks/use-space-quests';

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
    panelAvailable: true,
    openHumanChatPanel: vi.fn(),
    closeHumanChatPanel: vi.fn(),
    closeCoherenceChat: vi.fn(),
    requestQuestChat,
    dismissQuestChat: vi.fn(),
    setSpaceQuestDraft: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-space-quests', () => ({
  useQuestSpaceMembers: () => [],
  toQuestSpaceMemberPersons: () => [],
  findQuestSpaceMember: () => null,
  findQuestSpaceMemberId: () => null,
  createSpaceQuestRequest: vi.fn(),
  deleteSpaceQuestRequest: vi.fn(),
  patchSpaceQuestRequest: vi.fn(),
  getQuestDraftRequest: vi.fn(),
  saveQuestDraftRequest: vi.fn().mockResolvedValue({ id: 1 }),
  deleteQuestDraftRequest: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.mocked(saveQuestDraftRequest).mockClear();
  vi.mocked(getQuestDraftRequest).mockReset();
  requestQuestChat.mockClear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('quest create draft heading', () => {
  it('uses a static New quest heading and a Title card above Goal', () => {
    render(<SpaceQuestCreateDraft spaceSlug="sandbox" />);

    const heading = screen.getByRole('heading', { name: 'New quest' });
    expect(heading.getAttribute('data-testid')).toBe('quest-create-title');
    expect(heading.tagName).toBe('H1');
    expect(screen.queryByRole('textbox', { name: 'Quest title' })).toBeNull();
    const titleCard = screen.getByTestId('draft-section-name');
    expect(titleCard.textContent).toContain('TITLE');
    expect(titleCard.textContent).toContain(
      'Not set yet — reply in chat or click to edit',
    );
    const goal = screen.getByTestId('draft-section-goal');
    expect(
      titleCard.compareDocumentPosition(goal) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(
      screen.getByText('Fills in live as you chat · click any section to edit'),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Quest draft' })).toBeNull();
    expect(screen.queryByText('Quest draft')).toBeNull();
    expect(screen.getByTestId('cancel-quest-button')).toBeTruthy();
    expect(screen.queryByTestId('save-quest-draft-button')).toBeNull();
    const status = screen.getByTestId('quest-draft-save-status');
    const helper = screen.getByText(
      'Fills in live as you chat · click any section to edit',
    );
    const intro = screen.getByTestId('quest-create-intro');
    expect(intro.className).toContain('flex-col');
    expect(intro.className).toContain('gap-1');
    expect(intro.contains(heading)).toBe(true);
    expect(intro.contains(status)).toBe(true);
    expect(intro.contains(helper)).toBe(true);
    expect(status.textContent).toContain('Not saved yet');
    expect(
      heading.compareDocumentPosition(status) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      status.compareDocumentPosition(helper) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(status.className).toContain('h-[16.5px]');
    expect(status.className).toContain('min-w-[11.5rem]');
    expect(
      screen.getByTestId('cancel-quest-button').parentElement?.contains(status),
    ).toBe(false);
    const create = screen.getByTestId('create-quest-button');
    expect(create.textContent).toBe('CREATE PROPOSAL');
    const discussion = screen.getByTestId('open-quest-discussion-button');
    expect(discussion.textContent).toContain('Open discussion');
    expect(discussion.textContent).toContain('→');
    expect(discussion.className).toContain('text-xs');
    expect(discussion.className).toContain('font-bold');
    expect(discussion.className).toContain('underline-offset-2');
    expect(screen.queryByTestId('open-quest-chat-button')).toBeNull();
    expect(create.parentElement?.parentElement).toBe(discussion.parentElement);
    expect(
      create.compareDocumentPosition(discussion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(discussion.parentElement?.className).toContain('items-end');
    const draft = screen.getByText('Draft');
    expect(heading.nextElementSibling).toBe(draft);
    expect(draft.parentElement?.className).toContain('gap-2');
    expect(heading.className).toContain('font-display');
    expect(heading.className).toContain('text-[18px]');
    expect(draft.parentElement?.parentElement?.contains(status)).toBe(true);
    expect(draft.parentElement?.parentElement?.className).toContain('gap-1');
    expect(intro.querySelector('.w-\\[140px\\]')).toBeNull();
    expect(screen.queryByTestId('draft-section-deliverables')).toBeNull();
    expect(draft.parentElement?.contains(create)).toBe(false);
    expect(requestQuestChat).toHaveBeenCalled();
    const participants = screen.getByTestId('draft-section-members');
    const label = participants.querySelector('span');
    expect(label?.textContent).toBe('Participants');
    expect(label?.className).toContain('uppercase');
  });

  it('discards a focused Goal edit on Cancel and does not autosave it', async () => {
    render(<SpaceQuestCreateDraft spaceSlug="sandbox" />);

    expect(screen.getByTestId('quest-draft-save-status').textContent).toContain(
      'Not saved yet',
    );
    fireEvent.click(screen.getByTestId('draft-section-goal'));
    const editor = await screen.findByRole('textbox', {
      name: 'Rich text editor',
    });
    editor.focus();

    const tiptap = (
      editor as HTMLElement & {
        editor?: {
          commands: { insertContent: (text: string) => boolean };
        };
      }
    ).editor;
    expect(tiptap).toBeTruthy();
    tiptap?.commands.insertContent('Ship the focused goal');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('draft-section-goal').textContent).toContain(
      'Not set yet',
    );
    expect(screen.getByTestId('draft-section-goal').textContent).not.toContain(
      'Ship the focused goal',
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    expect(saveQuestDraftRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId('quest-draft-save-status').textContent).toContain(
      'Not saved yet',
    );
  });

  it('keeps Continue neutral until the saved draft hydrates', async () => {
    let resolveDraft: (
      value: Awaited<ReturnType<typeof getQuestDraftRequest>>,
    ) => void = () => undefined;
    vi.mocked(getQuestDraftRequest).mockReturnValue(
      new Promise((resolve) => {
        resolveDraft = resolve;
      }),
    );

    render(<SpaceQuestCreateDraft spaceSlug="sandbox" resumeDraftId={9} />);

    const status = screen.getByTestId('quest-draft-save-status');
    expect(status.getAttribute('data-state')).toBe('loading');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.className).toContain('h-[16.5px]');
    expect(status.className).toContain('min-w-[11.5rem]');
    expect(status.textContent ?? '').not.toContain('Not saved yet');
    expect(status.textContent ?? '').not.toContain('Saving…');
    expect(screen.getByTestId('quest-draft-loading')).toBeTruthy();
    expect(screen.queryByText('Untitled quest')).toBeNull();
    expect(screen.queryByText(/Not set yet/)).toBeNull();
    expect(screen.queryByText('Vlad Hramtsov (you)')).toBeNull();
    expect(saveQuestDraftRequest).not.toHaveBeenCalled();

    await act(async () => {
      resolveDraft({
        id: 9,
        name: 'Late checklist',
        updatedAt: '2026-11-09T21:00:00.000Z',
        payload: {
          draft: {
            name: 'Late checklist',
            goal: 'Finish the checklist',
            scopeIn: [],
            scopeOut: [],
            scopeInMarkdown: '',
            scopeOutMarkdown: '',
            successCriteria: '',
            rewards: [],
            milestones: [],
            leadName: 'Ada Lovelace',
            selectedLeadPersonId: null,
            members: [],
            targetDate: null,
          },
          messages: [
            {
              id: 'h1',
              role: 'member',
              senderName: 'Quest Helper',
              text: 'What should the goal be?',
              timestamp: '2026-11-09T21:00:00.000Z',
            },
          ],
          step: 1,
          pending: null,
        },
      });
    });

    expect(screen.getByTestId('draft-section-name').textContent).toContain(
      'Late checklist',
    );
    expect(screen.getByRole('heading', { name: 'New quest' })).toBeTruthy();
    expect(screen.getByText('Finish the checklist')).toBeTruthy();
    expect(screen.queryByTestId('quest-draft-loading')).toBeNull();
    const saved = screen.getByTestId('quest-draft-save-status');
    expect(saved.className).toContain('h-[16.5px]');
    expect(saved.className).toContain('min-w-[11.5rem]');
    expect(saved.textContent).toContain('Draft saved automatically');
    expect(saved.textContent).not.toContain('Not saved yet');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
    });
    expect(saveQuestDraftRequest).not.toHaveBeenCalled();
  });
});
