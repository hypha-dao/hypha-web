// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SignalVoteRoster,
  SignalVoteTotals,
} from '../../components/signal-vote-summary';

vi.mock('@hypha-platform/core/client', () => ({}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'myspace' }),
}));

afterEach(() => {
  cleanup();
});

const messages = {
  SignalCard: {
    votes: 'Votes',
    noVotesYet: 'No votes yet',
    voteUp: 'Up',
    voteDown: 'Down',
    upVotesCount: 'Up {count}',
    downVotesCount: 'Down {count}',
    upVotesPower: 'Up {count} · {power}',
    downVotesPower: 'Down {count} · {power}',
    votesCount: '{count, plural, one {# vote} other {# votes}}',
    anonymousSupporter: 'Member',
  },
};

function summary(
  partial: Partial<{
    totalVotingPower: string;
    upvoteCount: number;
    downvoteCount: number;
    upVotingPower: string;
    downVotingPower: string;
    netVoteCount: number;
    tokenDecimals: number;
    voters: {
      personId: number;
      name: string | null;
      avatarUrl: string | null;
      votingPower: string;
      direction?: 'up' | 'down';
    }[];
    myUpvote: null;
  }>,
) {
  return {
    totalVotingPower: '0',
    upvoteCount: 0,
    downvoteCount: 0,
    upVotingPower: '0',
    downVotingPower: '0',
    netVoteCount: 0,
    tokenDecimals: 0,
    voters: [],
    myUpvote: null,
    ...partial,
  };
}

function renderSummary(upvotes: CoherenceUpvoteSummary, totalLabel: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SignalVoteTotals
        summary={upvotes}
        totalLabel={totalLabel}
        mode="count"
      />
      <SignalVoteRoster summary={upvotes} mode="count" />
    </NextIntlClientProvider>,
  );
}

describe('signal vote summary', () => {
  it('shows the net, both sides, and a down row instead of an empty upvoter list', () => {
    const view = renderSummary(
      summary({
        netVoteCount: -1,
        downvoteCount: 1,
        downVotingPower: '4',
        totalVotingPower: '-4',
        voters: [
          {
            personId: 7,
            name: 'Vlad Hramtsov',
            avatarUrl: null,
            votingPower: '4',
            direction: 'down',
          },
        ],
      }),
      '-1',
    );

    expect(view.getByTestId('signal-votes-total').textContent).toContain(
      'Votes',
    );
    expect(view.getByTestId('signal-votes-total').textContent).toContain('-1');
    expect(view.getByTestId('signal-votes-up').textContent).toBe('Up 0');
    expect(view.getByTestId('signal-votes-down').textContent).toBe('Down 1');
    expect(view.queryByTestId('signal-votes-empty')).toBeNull();
    expect(
      view.getByTestId('signal-voter-row').getAttribute('data-vote-direction'),
    ).toBe('down');
    expect(view.getByTestId('signal-voter-direction').textContent).toBe('Down');
    expect(view.getByTestId('signal-voter-row').textContent).toContain(
      'Vlad Hramtsov',
    );
  });

  it('says there are no votes when nobody has voted', () => {
    const view = renderSummary(summary({}), '0');
    expect(view.getByTestId('signal-votes-empty').textContent).toBe(
      'No votes yet',
    );
    expect(view.queryByTestId('signal-voter-row')).toBeNull();
  });
});
