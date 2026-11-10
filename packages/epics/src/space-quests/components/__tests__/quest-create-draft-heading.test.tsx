// @vitest-environment jsdom

import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpaceQuestCreateDraft } from '../space-quest-create-draft';
import { saveQuestDraftRequest } from '../../hooks/use-space-quests';

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
        'drafts.savedAuto': 'Saved automatically',
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

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('quest create draft heading', () => {
  it('keeps New quest and drops the duplicate Quest draft title', () => {
    render(<SpaceQuestCreateDraft spaceSlug="sandbox" />);

    expect(screen.getByRole('heading', { name: 'New quest' })).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(
      screen.getByText('Fills in live as you chat · click any section to edit'),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Quest draft' })).toBeNull();
    expect(screen.queryByText('Quest draft')).toBeNull();
    expect(screen.getByTestId('cancel-quest-button')).toBeTruthy();
    expect(screen.queryByTestId('save-quest-draft-button')).toBeNull();
    expect(screen.getByTestId('quest-draft-save-status').textContent).toContain(
      'Not saved yet',
    );
    expect(screen.getByTestId('create-quest-button')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Open discussion/ }),
    ).toBeTruthy();
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
        ).toContain('Saved automatically');
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
});
