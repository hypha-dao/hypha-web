import { describe, expect, it } from 'vitest';

import { parseBridgeEndorsements } from '../endorsements';

describe('parseBridgeEndorsements', () => {
  it('accepts known Bridge endorsement values', () => {
    expect(parseBridgeEndorsements(['base', 'sepa'])).toEqual(['base', 'sepa']);
  });

  it('rejects unknown rail identifiers', () => {
    expect(() => parseBridgeEndorsements(['sepa', 'unknown_rail'])).toThrow();
  });
});
