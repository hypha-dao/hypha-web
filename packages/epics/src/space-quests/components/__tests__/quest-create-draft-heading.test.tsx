// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpaceQuestCreateDraft } from '../space-quest-create-draft';

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
    expect(screen.getByRole('link', { name: 'CANCEL' })).toBeTruthy();
    expect(screen.getByTestId('create-quest-button')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Open discussion/ }),
    ).toBeTruthy();
    const participants = screen.getByTestId('draft-section-members');
    const label = participants.querySelector('span');
    expect(label?.textContent).toBe('Participants');
    expect(label?.className).toContain('uppercase');
  });
});
