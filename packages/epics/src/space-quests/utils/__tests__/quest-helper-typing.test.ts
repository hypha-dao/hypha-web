import { describe, expect, it } from 'vitest';
import {
  questHelperTypingAfterTurn,
  questHelperTypingForTurn,
} from '../quest-helper-typing';

/**
 * The create screen applies these two calls in order for each send:
 * typing becomes questHelperTypingForTurn(usesModel) immediately, then
 * questHelperTypingAfterTurn(thisGeneration, latestGeneration) when the
 * await finishes.
 */
function runTurns(
  turns: ReadonlyArray<{ usesModel: boolean; finish: 'pending' | 'done' }>,
) {
  let latest = 0;
  let typing = false;
  const pending: number[] = [];
  for (const turn of turns) {
    const generation = ++latest;
    typing = questHelperTypingForTurn(turn.usesModel);
    if (turn.finish === 'done') {
      const next = questHelperTypingAfterTurn(generation, latest);
      if (next === false) typing = false;
    } else {
      pending.push(generation);
    }
  }
  return {
    typing,
    finish(generation: number) {
      const next = questHelperTypingAfterTurn(generation, latest);
      if (next === false) typing = false;
      return typing;
    },
  };
}

describe('quest helper typing generations', () => {
  it('clears a pending model when a deterministic turn takes over, and ignores the stale completion', () => {
    const session = runTurns([
      { usesModel: true, finish: 'pending' },
      { usesModel: false, finish: 'done' },
    ]);
    expect(session.typing).toBe(false);
    expect(session.finish(1)).toBe(false);
  });

  it('does not let a stale model completion hide a newer model turn', () => {
    const session = runTurns([
      { usesModel: true, finish: 'pending' },
      { usesModel: true, finish: 'pending' },
    ]);
    expect(session.typing).toBe(true);
    expect(session.finish(1)).toBe(true);
    expect(session.finish(2)).toBe(false);
  });
});
