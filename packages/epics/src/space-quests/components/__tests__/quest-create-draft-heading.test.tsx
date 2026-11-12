// @vitest-environment jsdom

import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
  it('uses the title field as the header and drops the duplicate name card', () => {
    render(<SpaceQuestCreateDraft spaceSlug="sandbox" />);

    const heading = screen.getByLabelText('Quest title');
    expect(heading.getAttribute('placeholder')).toBe('New quest');
    expect(screen.queryByTestId('draft-section-name')).toBeNull();
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
    expect(draft.parentElement?.contains(create)).toBe(false);
    expect(requestQuestChat).toHaveBeenCalled();
    const participants = screen.getByTestId('draft-section-members');
    const label = participants.querySelector('span');
    expect(label?.textContent).toBe('Participants');
    expect(label?.className).toContain('uppercase');
  });

  it('autosaves a focused Goal edit without waiting for blur', async () => {
    render(<SpaceQuestCreateDraft spaceSlug="sandbox" />);

    expect(screen.getByTestId('quest-draft-save-status').textContent).toContain(
      'Not saved yet',
    );
    fireEvent.click(screen.getByTestId('draft-section-goal'));
    const editor = await screen.findByRole('textbox', {
      name: 'Rich text editor',
    });
    editor.focus();
    expect(screen.getByTestId('quest-draft-save-status').textContent).toContain(
      'Not saved yet',
    );

    const tiptap = (
      editor as HTMLElement & {
        editor?: {
          commands: { insertContent: (text: string) => boolean };
        };
      }
    ).editor;
    expect(tiptap).toBeTruthy();
    tiptap?.commands.insertContent('Ship the focused goal');

    expect(
      editor.contains(document.activeElement) ||
        document.activeElement === editor,
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.getByTestId('quest-draft-save-status').textContent,
      ).toContain('Saving…');
    });
    expect(saveQuestDraftRequest).not.toHaveBeenCalled();
    await waitFor(
      () => {
        expect(
          screen.getByTestId('quest-draft-save-status').textContent,
        ).toContain('Draft saved automatically');
      },
      { timeout: 3000 },
    );
    expect(screen.queryByText('Not saved yet')).toBeNull();
    expect(saveQuestDraftRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          draft: expect.objectContaining({
            goal: expect.stringContaining('Ship the focused goal'),
          }),
        }),
      }),
    );
    expect(
      document.activeElement === editor ||
        editor.contains(document.activeElement),
    ).toBe(true);
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

    expect(await screen.findByDisplayValue('Late checklist')).toBeTruthy();
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
