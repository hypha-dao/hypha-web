import { describe, expect, it } from 'vitest';

import { formatBlockchainError } from '../format-blockchain-error';

describe('formatBlockchainError', () => {
  it('splits a simulation revert onto a sentence, a selector, and each word', () => {
    const address = '9997c22f06f0ac67df07c8cb2a08562c53dd4e9f';
    const word = `${'0'.repeat(24)}${address}`;
    const formatted = formatBlockchainError(
      `UserOperation reverted during simulation with reason: 0xfb8f41b2${word}${'0'.repeat(
        64,
      )}`,
    );

    expect(formatted.split('\n')).toEqual([
      'UserOperation reverted during simulation with reason:',
      '0xfb8f41b2',
      word,
      '0'.repeat(64),
    ]);
  });

  it('leaves a short message on one line', () => {
    expect(formatBlockchainError('The signature was dismissed.')).toBe(
      'The signature was dismissed.',
    );
  });
});
