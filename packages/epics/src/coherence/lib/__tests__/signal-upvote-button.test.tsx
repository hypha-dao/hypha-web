// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signalUpvoteCellMeasure } from '../../../../../core/src/coherence/signal-ranking';
import { SignalUpvoteButton } from '../../components/signal-upvote-button';

const calls = vi.hoisted(() => ({
  upvote: vi.fn(),
  removeUpvote: vi.fn(),
}));

vi.mock('@hypha-platform/core/client', () => ({
  applyPendingSignalUpvotes: vi.fn(),
  resolveSignalVoteAction: (
    current: 'up' | 'down' | null,
    clicked: 'up' | 'down',
  ) => (current === clicked ? 'remove' : clicked),
  signalUpvoteCellMeasure,
  useCoherenceUpvoteMutations: () => ({
    upvote: calls.upvote,
    removeUpvote: calls.removeUpvote,
    isUpvoting: false,
    isRemovingUpvote: false,
  }),
  useJwt: () => ({ jwt: 'token' }),
  useMySignalVotingPower: () => ({
    votingPower: null,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'myspace' }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: { amount?: string }) =>
    values?.amount ? `${key}:${values.amount}` : key,
  useFormatter: () => ({
    number: (value: number) => String(value),
  }),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver ??
  (ResizeObserverStub as unknown as typeof ResizeObserver);

const summary = {
  totalVotingPower: '0',
  upvoteCount: 0,
  downvoteCount: 0,
  upVotingPower: '0',
  downVotingPower: '0',
  netVoteCount: 0,
  tokenDecimals: 0,
  voters: [],
  myUpvote: null,
};

afterEach(() => {
  cleanup();
  calls.upvote.mockReset();
  calls.removeUpvote.mockReset();
});

describe('SignalUpvoteButton', () => {
  it('toggles a one-member vote from the arrow without a slider', () => {
    calls.upvote.mockResolvedValue({
      ...summary,
      upvoteCount: 1,
      netVoteCount: 1,
      myUpvote: { votingPower: '1', maxVotingPower: '1', direction: 'up' },
    });
    const view = render(
      <SignalUpvoteButton
        slug="signal"
        spaceSlug="myspace"
        votingMode="one-member-one-vote"
        upvotes={summary}
      />,
    );

    fireEvent.click(view.getByTestId('signal-vote-up'));
    expect(calls.upvote).toHaveBeenCalledWith({
      slug: 'signal',
      direction: 'up',
    });
    expect(view.queryByTestId('signal-vote-allocation')).toBeNull();
  });

  it('asks for a share of voting power before a token vote, then confirms it', async () => {
    calls.upvote.mockResolvedValue({
      ...summary,
      totalVotingPower: '4',
      upVotingPower: '4',
      upvoteCount: 1,
      netVoteCount: 1,
      tokenDecimals: 0,
      myUpvote: { votingPower: '4', maxVotingPower: '4', direction: 'up' },
    });
    const view = render(
      <SignalUpvoteButton
        slug="signal"
        spaceSlug="myspace"
        votingMode="token"
        upvotes={{
          ...summary,
          myUpvote: {
            votingPower: '1',
            maxVotingPower: '4',
            direction: 'down',
          },
          voters: [
            {
              personId: 3,
              name: 'Ada',
              avatarUrl: null,
              votingPower: '1',
              direction: 'up',
            },
          ],
        }}
      />,
    );

    fireEvent.click(view.getByTestId('signal-vote-up'));
    expect(calls.upvote).not.toHaveBeenCalled();
    expect(view.queryByTestId('signal-vote-percent')).toBeNull();
    expect(view.queryByText(/%/)).toBeNull();
    expect(view.getByTestId('signal-vote-amount').textContent).toBe('4');
    expect(view.getByTestId('signal-allocation-voters').textContent).toContain(
      'Ada',
    );
    expect(view.getByTestId('signal-vote-cancel')).toBeTruthy();
    expect(view.getByTestId('signal-vote-confirm')).toBeTruthy();
    expect(view.getByRole('button', { name: 'removeDownvote' })).toBeTruthy();
    const slider = view.getByTestId('signal-vote-slider');
    for (let step = 0; step < 50; step += 1) {
      fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    }
    expect(view.getByTestId('signal-vote-amount').textContent).toBe('2');
    fireEvent.click(view.getByTestId('signal-vote-confirm'));

    await waitFor(() => {
      expect(calls.upvote).toHaveBeenCalledWith({
        slug: 'signal',
        direction: 'up',
        votingPowerPercent: 50,
      });
    });
  });

  it('shows a fractional token net instead of the voter count', () => {
    const half = (10n ** 18n / 2n).toString();
    const quarterMore = ((10n ** 18n * 125n) / 100n).toString();
    const fractional = {
      ...summary,
      upvoteCount: 1,
      downvoteCount: 0,
      netVoteCount: 1,
      tokenDecimals: 18,
      totalVotingPower: half,
      upVotingPower: half,
    };
    const listed = render(
      <SignalUpvoteButton
        slug="signal"
        spaceSlug="myspace"
        votingMode="token"
        sort="new"
        upvotes={fractional}
      />,
    );
    expect(listed.getByTestId('signal-upvote-figure').textContent).toBe('0.5');
    listed.unmount();

    const detail = render(
      <SignalUpvoteButton
        slug="signal"
        spaceSlug="myspace"
        votingMode="token"
        upvotes={{
          ...fractional,
          totalVotingPower: quarterMore,
          upVotingPower: quarterMore,
        }}
      />,
    );
    expect(detail.getByTestId('signal-upvote-figure').textContent).toBe('1.25');
    detail.unmount();

    const ranked = render(
      <SignalUpvoteButton
        slug="signal"
        spaceSlug="myspace"
        votingMode="token"
        sort="top-power"
        upvotes={{
          ...fractional,
          totalVotingPower: `-${half}`,
          downVotingPower: half,
          upVotingPower: '0',
          upvoteCount: 0,
          downvoteCount: 1,
          netVoteCount: -1,
        }}
      />,
    );
    expect(ranked.getByTestId('signal-upvote-figure').textContent).toBe('-0.5');
    ranked.unmount();

    const headcount = render(
      <SignalUpvoteButton
        slug="signal"
        spaceSlug="myspace"
        votingMode="one-member-one-vote"
        sort="top-power"
        upvotes={fractional}
      />,
    );
    expect(headcount.getByTestId('signal-upvote-figure').textContent).toBe('1');
  });

  it('closes the token allocation panel on cancel without voting', () => {
    const view = render(
      <SignalUpvoteButton
        slug="signal"
        spaceSlug="myspace"
        votingMode="token"
        upvotes={summary}
      />,
    );

    fireEvent.click(view.getByTestId('signal-vote-down'));
    expect(view.getByTestId('signal-vote-allocation')).toBeTruthy();
    fireEvent.click(view.getByTestId('signal-vote-cancel'));
    expect(view.queryByTestId('signal-vote-allocation')).toBeNull();
    expect(calls.upvote).not.toHaveBeenCalled();
  });
});
