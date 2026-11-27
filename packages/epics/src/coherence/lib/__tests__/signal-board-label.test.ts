import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGNAL_WORKFLOW,
  type SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import {
  activeSignalBoards,
  hasSignalBoardChoice,
  signalBoardLabel,
} from '../signal-board-label';

const twoBoards: SignalWorkflowConfig = {
  ...DEFAULT_SIGNAL_WORKFLOW,
  boards: [
    { slug: 'energy', name: 'Energy', color: 'accent', position: 1 },
    { slug: 'general', name: 'General', color: 'neutral', position: 0 },
    {
      slug: 'old',
      name: 'Old',
      color: 'neutral',
      position: 2,
      archived: true,
    },
  ],
};

describe('activeSignalBoards', () => {
  it('drops archived boards and orders by position', () => {
    expect(activeSignalBoards(twoBoards).map((board) => board.slug)).toEqual([
      'general',
      'energy',
    ]);
  });

  it('is empty without a workflow', () => {
    expect(activeSignalBoards(null)).toEqual([]);
  });
});

describe('hasSignalBoardChoice', () => {
  it('is false for the default single board', () => {
    expect(hasSignalBoardChoice(DEFAULT_SIGNAL_WORKFLOW)).toBe(false);
  });

  it('is true with two active boards', () => {
    expect(hasSignalBoardChoice(twoBoards)).toBe(true);
  });

  it('does not count archived boards', () => {
    const oneActive: SignalWorkflowConfig = {
      ...twoBoards,
      boards: twoBoards.boards.filter((board) => board.slug !== 'energy'),
    };
    expect(hasSignalBoardChoice(oneActive)).toBe(false);
  });
});

describe('signalBoardLabel', () => {
  it('names the board the signal sits on', () => {
    expect(signalBoardLabel('energy', twoBoards)).toBe('Energy');
  });

  it('reads an unset or unknown board as the default board', () => {
    expect(signalBoardLabel(null, twoBoards)).toBe('General');
    expect(signalBoardLabel('missing', twoBoards)).toBe('General');
  });

  it('reads an archived board as the default board', () => {
    expect(signalBoardLabel('old', twoBoards)).toBe('General');
  });

  it('is null when the space has a single board', () => {
    expect(signalBoardLabel('general', DEFAULT_SIGNAL_WORKFLOW)).toBeNull();
  });

  it('is null before the workflow loads', () => {
    expect(signalBoardLabel('energy', undefined)).toBeNull();
  });
});
