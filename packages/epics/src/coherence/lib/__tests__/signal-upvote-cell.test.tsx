// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignalUpvoteCellChrome } from '../../components/signal-upvote-cell';

afterEach(() => {
  cleanup();
});

describe('SignalUpvoteCellChrome', () => {
  it('keeps the net caption beside the figure and toggles up and down', () => {
    const onVoteUp = vi.fn();
    const onVoteDown = vi.fn();
    const view = render(
      <SignalUpvoteCellChrome
        figure="-2"
        exactLabel="-2"
        label="Net"
        pressed
        direction="down"
        upLabel="Upvote"
        downLabel="Remove downvote"
        onVoteUp={onVoteUp}
        onVoteDown={onVoteDown}
      />,
    );

    const cell = view.getByTestId('signal-upvote-cell');
    const figure = view.getByTestId('signal-upvote-figure');
    expect(cell.getAttribute('aria-pressed')).toBe('true');
    expect(cell.getAttribute('title')).toBe('-2');
    expect(figure.nextElementSibling?.textContent).toBe('Net');
    expect(
      view.getByTestId('signal-vote-down').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      view.getByTestId('signal-vote-up').getAttribute('aria-pressed'),
    ).toBe('false');

    fireEvent.click(view.getByTestId('signal-vote-up'));
    fireEvent.click(view.getByTestId('signal-vote-down'));
    expect(onVoteUp).toHaveBeenCalledTimes(1);
    expect(onVoteDown).toHaveBeenCalledTimes(1);
  });
});
