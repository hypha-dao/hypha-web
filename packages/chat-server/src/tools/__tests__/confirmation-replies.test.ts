import { describe, expect, it } from 'vitest';

import { isPlainConfirmationReply } from '../confirmation-replies';

describe('isPlainConfirmationReply', () => {
  it('accepts multilingual short affirmatives', () => {
    expect(isPlainConfirmationReply('oui')).toBe(true);
    expect(isPlainConfirmationReply('Oui.')).toBe(true);
    expect(isPlainConfirmationReply("d'accord")).toBe(true);
    expect(isPlainConfirmationReply('sim')).toBe(true);
    expect(isPlainConfirmationReply('sí')).toBe(true);
    expect(isPlainConfirmationReply('ja')).toBe(true);
    expect(isPlainConfirmationReply('genau')).toBe(true);
  });

  it('rejects non-confirmations', () => {
    expect(isPlainConfirmationReply('maybe later')).toBe(false);
    expect(isPlainConfirmationReply('open access')).toBe(false);
  });
});
