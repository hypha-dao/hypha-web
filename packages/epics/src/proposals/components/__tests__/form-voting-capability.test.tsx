// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormVoting } from '../form-voting';
import { ActionCapabilitiesProvider } from '../../../common/action-capabilities';

vi.mock('@hypha-platform/core/client', () => ({
  useMyVote: () => ({ myVote: null, mutate: vi.fn() }),
  useIsDelegate: () => ({ isDelegate: false }),
  useMe: () => ({ person: { address: '0xabc' } }),
  useWithdrawProposal: () => ({
    withdrawProposal: vi.fn(),
    isWithdrawing: false,
  }),
  useJwt: () => ({ jwt: 'token' }),
  useAgreementMutationsWeb2Rsc: () => ({ deleteAgreementBySlug: vi.fn() }),
  useSpaceMinProposalDuration: () => ({ duration: 0 }),
  useSpaceBySlug: () => ({ space: undefined }),
  normalizeProposalDocumentLabel: (l: string) => l,
  SPACE_CONTEXT_DOCUMENT_LABEL: 'Space Context',
  sectionKeysFromProposalMarkdown: () => [],
}));
vi.mock('@hypha-platform/core/governance/server/actions', () => ({
  getTokenUpdateByDocumentIdAction: vi.fn(),
}));
vi.mock('../../../spaces', () => ({
  useSpaceMember: () => ({ isMember: true }),
}));
vi.mock('@hypha-platform/ui', () => ({
  Button: ({ children, ...rest }: React.ComponentProps<'button'>) => (
    <button {...(rest as object)}>{children}</button>
  ),
  Skeleton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Separator: () => null,
  Image: () => null,
}));
vi.mock('@hypha-platform/ui-utils', () => ({
  getDurationParts: () => ({}),
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ lang: 'en' }),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('../withdraw-resubmit-banner', () => ({
  WithdrawResubmitBanner: ({ hideResubmit }: { hideResubmit?: boolean }) => (
    <div data-testid="withdraw" data-hide-resubmit={String(hideResubmit)} />
  ),
}));
vi.mock('../progress-line', () => ({ ProgressLine: () => null }));
vi.mock('../../../governance/components/voter-list', () => ({
  VoterList: () => null,
}));

afterEach(cleanup);

const future = new Date(Date.now() + 86_400_000).toISOString();
const base = {
  unity: 10,
  quorum: 10,
  endTime: future,
  isCheckingExpiration: false,
  onAccept: vi.fn(),
  onReject: vi.fn(),
  documentSlug: 'doc',
  isAuthenticated: true,
  web3SpaceId: 1,
  proposalStatus: 'onVoting',
  proposalCreator: '0xabc' as `0x${string}`,
  label: 'Contribution',
  executed: false,
  expired: false,
};

const withCapability = (voteLive: boolean | null, readOnly: boolean) => {
  const node = <FormVoting {...base} readOnly={readOnly} />;
  return render(
    voteLive === null ? (
      node
    ) : (
      <ActionCapabilitiesProvider
        value={{
          unsupportedActions: 'hide',
          fullAppOrigin: '',
          pipelineData: false,
          voteLive,
        }}
      >
        {node}
      </ActionCapabilitiesProvider>
    ),
  );
};

describe('FormVoting vote capability', () => {
  it('main app (no provider, not read-only): vote and withdraw show', () => {
    const { queryByText, queryByTestId } = withCapability(null, false);
    expect(queryByText('voting.voteYes')).not.toBeNull();
    expect(queryByTestId('withdraw')).not.toBeNull();
  });

  it('read-only host (cannot vote): no vote, no withdraw', () => {
    const { queryByText, queryByTestId } = withCapability(false, true);
    expect(queryByText('voting.voteYes')).toBeNull();
    expect(queryByTestId('withdraw')).toBeNull();
  });

  it('login host (can vote): vote and withdraw show, resubmit stays hidden', () => {
    const { queryByText, queryByTestId } = withCapability(true, true);
    expect(queryByText('voting.voteYes')).not.toBeNull();
    expect(queryByTestId('withdraw')?.getAttribute('data-hide-resubmit')).toBe(
      'true',
    );
  });
});
