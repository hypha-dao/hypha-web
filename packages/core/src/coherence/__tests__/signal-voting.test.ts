import { describe, expect, it } from 'vitest';
import { resolveSignalVoteAction } from '../signal-voting';

describe('resolveSignalVoteAction', () => {
  it('records the clicked direction when there is no vote', () => {
    expect(resolveSignalVoteAction(null, 'up')).toBe('up');
    expect(resolveSignalVoteAction(undefined, 'down')).toBe('down');
  });

  it('clears the selected direction and switches the other way', () => {
    expect(resolveSignalVoteAction('up', 'up')).toBe('remove');
    expect(resolveSignalVoteAction('down', 'down')).toBe('remove');
    expect(resolveSignalVoteAction('up', 'down')).toBe('down');
    expect(resolveSignalVoteAction('down', 'up')).toBe('up');
  });
});
