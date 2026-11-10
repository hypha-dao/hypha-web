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
import { SpaceQuestsSection } from '../space-quests-section';

const harness = vi.hoisted(() => ({
  visible: true,
  drafts: [
    {
      id: 4,
      name: 'Alpha draft',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 5,
      name: 'Beta draft',
      updatedAt: new Date().toISOString(),
    },
  ],
  deleteQuestDraftRequest: vi.fn().mockResolvedValue(undefined),
}));

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
  useTranslations: () => (key: string, values?: { when?: string }) =>
    values?.when ? `${key} ${values.when}` : key,
}));

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    getAccessToken: async () => 'token',
  }),
}));

vi.mock('@hypha-platform/core/client', () => ({
  QUEST_LIST_FILTERS: ['active', 'proposed', 'paused', 'completed'],
  useSpaceBySlug: () => ({ space: { slug: 'sandbox' } }),
  formatQuestCalendarDate: () => '',
  questHealthDisplay: () => ({
    dotClass: '',
    textClass: '',
    label: '',
  }),
}));

vi.mock('../../../spaces/hooks/use-can-mutate-in-space.web3.rpc', () => ({
  useCanMutateInSpace: () => ({ canMutate: true }),
}));

vi.mock('../../hooks/use-space-quests', () => ({
  useSpaceQuests: () => ({
    overview: {
      quests: [],
      counts: {
        active: 0,
        proposed: 0,
        paused: 0,
        completed: 0,
        archived: 0,
        total: 0,
      },
    },
    isLoading: false,
    error: undefined,
    refresh: vi.fn(),
  }),
  useMyQuestDrafts: () => ({
    drafts: harness.visible ? harness.drafts : [],
    visible: harness.visible,
  }),
  deleteQuestDraftRequest: harness.deleteQuestDraftRequest,
  useQuestSpaceMembers: () => [],
  findQuestSpaceMember: () => null,
}));

afterEach(() => {
  cleanup();
  harness.visible = true;
  harness.drafts = [
    {
      id: 4,
      name: 'Alpha draft',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 5,
      name: 'Beta draft',
      updatedAt: new Date().toISOString(),
    },
  ];
  harness.deleteQuestDraftRequest.mockReset();
  harness.deleteQuestDraftRequest.mockResolvedValue(undefined);
});

describe('quest list drafts', () => {
  it('shows only the signed-in author’s drafts, with continue and delete', async () => {
    render(<SpaceQuestsSection spaceSlug="sandbox" />);

    expect(
      screen
        .getAllByRole('link', { name: 'newQuest' })
        .every((link) =>
          link.getAttribute('href')?.endsWith('/quests/new?fresh=1'),
        ),
    ).toBe(true);
    fireEvent.click(screen.getByTestId('quest-filter-drafts'));

    expect(screen.getByTestId('quest-draft-4')).toBeTruthy();
    expect(screen.getByText('Alpha draft')).toBeTruthy();
    expect(screen.getAllByText(/drafts\.edited just now/)).toHaveLength(2);
    expect(
      screen.getByTestId('continue-quest-draft-4').getAttribute('href'),
    ).toBe('/en/dho/sandbox/quests/new?draft=4');

    fireEvent.change(screen.getByTestId('search-quests-input'), {
      target: { value: 'beta' },
    });
    expect(screen.queryByTestId('quest-draft-4')).toBeNull();
    expect(screen.getByTestId('quest-draft-5')).toBeTruthy();

    fireEvent.change(screen.getByTestId('search-quests-input'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByTestId('delete-quest-draft-4'));
    fireEvent.click(screen.getByTestId('confirm-delete-quest-draft'));

    await waitFor(() => {
      expect(harness.deleteQuestDraftRequest).toHaveBeenCalledWith(
        expect.objectContaining({ spaceSlug: 'sandbox', draftId: 4 }),
      );
    });
    expect(screen.queryByTestId('confirm-delete-quest-draft')).toBeNull();
  });

  it('closes the confirm at once and shows an error when delete fails', async () => {
    harness.deleteQuestDraftRequest.mockRejectedValue(new Error('no'));
    render(<SpaceQuestsSection spaceSlug="sandbox" />);
    fireEvent.click(screen.getByTestId('quest-filter-drafts'));
    fireEvent.click(screen.getByTestId('delete-quest-draft-4'));
    fireEvent.click(screen.getByTestId('confirm-delete-quest-draft'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-delete-quest-draft')).toBeNull();
    });
    expect(screen.getByTestId('quest-draft-delete-error').textContent).toBe(
      'drafts.deleteFailed',
    );
    expect(screen.getByTestId('quest-draft-4')).toBeTruthy();
  });

  it('hides My drafts when nobody is signed in', () => {
    harness.visible = false;
    render(<SpaceQuestsSection spaceSlug="sandbox" />);
    expect(screen.queryByTestId('quest-filter-drafts')).toBeNull();
  });
});
