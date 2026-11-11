// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignalUpvoteCellChrome } from '../../components/signal-upvote-cell';

afterEach(() => {
  cleanup();
});

describe('SignalUpvoteCellChrome', () => {
  it('lays the net figure between the arrows and toggles up and down', () => {
    const onVoteUp = vi.fn();
    const onVoteDown = vi.fn();
    const onFigureClick = vi.fn();
    const view = render(
      <SignalUpvoteCellChrome
        figure="-2"
        exactLabel="-2"
        figureLabel="Votes · -2"
        pressed
        direction="down"
        upLabel="Upvote"
        downLabel="Remove downvote"
        onVoteUp={onVoteUp}
        onVoteDown={onVoteDown}
        onFigureClick={onFigureClick}
      />,
    );

    const cell = view.getByTestId('signal-upvote-cell');
    const up = view.getByTestId('signal-vote-up');
    const figure = view.getByTestId('signal-upvote-figure');
    const down = view.getByTestId('signal-vote-down');
    expect(cell.getAttribute('aria-pressed')).toBe('true');
    expect(cell.getAttribute('title')).toBe('-2');
    expect(cell.className).toContain('rounded-full');
    expect(cell.textContent).not.toContain('Net');
    expect(up.compareDocumentPosition(figure)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(figure.compareDocumentPosition(down)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(figure.getAttribute('aria-label')).toBe('Votes · -2');
    expect(down.getAttribute('aria-pressed')).toBe('true');
    expect(up.getAttribute('aria-pressed')).toBe('false');
    expect(up.getAttribute('aria-haspopup')).toBeNull();

    fireEvent.click(up);
    fireEvent.click(down);
    fireEvent.click(figure);
    expect(onVoteUp).toHaveBeenCalledTimes(1);
    expect(onVoteDown).toHaveBeenCalledTimes(1);
    expect(onFigureClick).toHaveBeenCalledTimes(1);
  });

  it('marks the arrows as dialogs when an allocation panel is attached', () => {
    const view = render(
      <SignalUpvoteCellChrome
        figure="4"
        exactLabel="4"
        pressed={false}
        allocationDirection="up"
        allocationPanel={<div>Allocate</div>}
        onVoteUp={() => undefined}
        onVoteDown={() => undefined}
      />,
    );
    expect(
      view.getByTestId('signal-vote-up').getAttribute('aria-haspopup'),
    ).toBe('dialog');
    expect(
      view.getByTestId('signal-vote-up').getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      view.getByTestId('signal-vote-down').getAttribute('aria-expanded'),
    ).toBe('false');
  });
});
