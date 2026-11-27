// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignalPage } from '../../components/signal-page';
import { ActionCapabilitiesProvider } from '../../../common/action-capabilities';

const h = vi.hoisted(() => ({
  acknowledge: vi.fn(() => Promise.resolve()),
  signal: {
    id: 1,
    slug: 'sig',
    title: 'A signal',
    type: 'opportunity',
    description: '',
    creatorId: 2,
    upvotes: 0,
    assigneeIds: [5],
    assigneeAcknowledgedAt: {},
  },
}));

vi.mock('@hypha-platform/core/client', () => ({
  signalListUpvoteSummaryState: () => 'ready',
  useCoherenceMutationsWeb2Rsc: () => ({
    acknowledgeCoherenceAssignment: h.acknowledge,
  }),
  useFindCoherences: () => ({
    coherences: [h.signal],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useJwt: () => ({ jwt: 'token' }),
  useMatrix: () => ({ client: null }),
  useMe: () => ({ person: { id: 5 } }),
  usePeopleBySubs: () => ({ peopleBySub: new Map() }),
  usePersonById: () => ({ person: undefined }),
  useSpaceBySlug: () => ({ space: undefined }),
  useSignalWorkflow: () => ({ workflow: undefined, isLoading: false }),
  usePatchCoherenceTask: () => ({ patchTask: vi.fn(), isPatching: false }),
  applyPendingCoherenceTaskPatch: vi.fn(),
  resolveEffectiveBoard: (board: string | null | undefined) =>
    board ?? 'general',
}));
vi.mock('../../hooks/use-can-update-signal-tasks', () => ({
  useCanUpdateSignalTasks: () => ({ canUpdateTasks: false, isLoading: false }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
vi.mock('next-intl', () => ({
  useFormatter: () => ({ relativeTime: () => '' }),
  useNow: () => new Date(0),
  useTranslations: () => (key: string) => key,
}));
vi.mock('@hypha-platform/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  MarkdownSuspense: () => null,
  Skeleton: () => null,
}));
vi.mock('../../../common/human-chat-panel-context', () => ({
  useHumanChatPanel: () => ({
    openCoherenceChat: vi.fn(),
    closeCoherenceChat: vi.fn(),
    closeHumanChatPanel: vi.fn(),
  }),
}));
vi.mock('../../../people/components/person-avatar', () => ({
  PersonAvatar: () => null,
}));
vi.mock('../../hooks/use-signal-creator-meta', () => ({
  useSignalCreatorMeta: () => ({ creatorDisplayName: 'Ada' }),
}));
vi.mock('../../hooks/use-signal-room-activity', () => ({
  useSignalRoomActivity: () => ({}),
}));
vi.mock('../../hooks/use-is-signal-space-non-member', () => ({
  useSignalSpaceMembership: () => ({
    isNonMember: false,
    isMembershipPending: false,
  }),
}));
vi.mock('../../hooks/use-signal-voting-mode', () => ({
  signalVotingSpaceId: () => null,
  useSignalVotingMode: () => ({
    votingMode: 'ready',
    status: 'ready',
    retry: vi.fn(),
  }),
}));
vi.mock('../../components/signal-creator-actions', () => ({
  SignalCreatorActions: () => <div data-testid="creator-actions" />,
}));
vi.mock('../../components/signal-upvote-button', () => ({
  SignalUpvoteButton: () => <div data-testid="upvote" />,
}));
vi.mock('../../components/signal-media-chips', () => ({
  useSignalMediaSummary: () => null,
}));
vi.mock('../../components/signal-feed-row', () => ({
  useSignalShortDate: () => () => '',
}));
vi.mock('../../components/signal-type-badge', () => ({
  SignalTypeBadge: () => null,
}));
vi.mock('../../components/signal-tag-badges', () => ({
  SignalTagBadges: () => null,
}));
vi.mock('../../components/signal-video-player', () => ({
  SignalVideoPlayer: () => null,
}));
vi.mock(
  '../../components/legacy-signal-fields/legacy-signal-fields-detail',
  () => ({ LegacySignalFieldsDetail: () => null }),
);

afterEach(() => {
  cleanup();
  h.acknowledge.mockClear();
});

const props = { lang: 'en' as never, spaceSlug: 'space', signalSlug: 'sig' };

describe('SignalPage readOnly', () => {
  it('default: upvote and creator actions show, and the assignee is acknowledged', () => {
    const { queryByTestId } = render(<SignalPage {...props} />);
    expect(queryByTestId('upvote')).not.toBeNull();
    expect(queryByTestId('creator-actions')).not.toBeNull();
    expect(queryByTestId('signal-convert')).not.toBeNull();
    expect(h.acknowledge).toHaveBeenCalledTimes(1);
  });

  it('readOnly: no upvote, no creator actions, no write on mount', () => {
    const { queryByTestId } = render(<SignalPage {...props} readOnly />);
    expect(queryByTestId('upvote')).toBeNull();
    expect(queryByTestId('creator-actions')).toBeNull();
    expect(queryByTestId('signal-convert')).toBeNull();
    expect(h.acknowledge).not.toHaveBeenCalled();
  });

  it('readOnly still shows the signal itself', () => {
    const { getByText } = render(<SignalPage {...props} readOnly />);
    expect(getByText('A signal', { selector: 'h1' })).toBeTruthy();
  });

  const withCapability = (voteLive: boolean) => (
    <ActionCapabilitiesProvider
      value={{
        unsupportedActions: 'hide',
        fullAppOrigin: '',
        pipelineData: false,
        voteLive,
      }}
    >
      <SignalPage {...props} readOnly />
    </ActionCapabilitiesProvider>
  );

  it('readOnly on a host that can vote: upvote shows, the rest stays hidden', () => {
    const { queryByTestId } = render(withCapability(true));
    expect(queryByTestId('upvote')).not.toBeNull();
    expect(queryByTestId('creator-actions')).toBeNull();
    expect(h.acknowledge).not.toHaveBeenCalled();
  });

  it('readOnly on a host that cannot vote: no upvote', () => {
    const { queryByTestId } = render(withCapability(false));
    expect(queryByTestId('upvote')).toBeNull();
  });
});
