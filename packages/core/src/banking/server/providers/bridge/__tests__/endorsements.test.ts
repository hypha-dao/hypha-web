import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BRIDGE_KYC_ENDORSEMENTS,
  parseBridgeEndorsements,
  resolveBridgeKycEndorsements,
} from '../endorsements';

describe('parseBridgeEndorsements', () => {
  it('accepts known Bridge endorsement values', () => {
    expect(parseBridgeEndorsements(['base', 'sepa'])).toEqual(['base', 'sepa']);
  });

  it('rejects payment rails (ach is not an EndorsementType)', () => {
    expect(() => parseBridgeEndorsements(['ach'])).toThrow();
  });

  it('rejects unknown rail identifiers', () => {
    expect(() => parseBridgeEndorsements(['sepa', 'unknown_rail'])).toThrow();
  });
});

describe('resolveBridgeKycEndorsements', () => {
  it('defaults to USD and EUR when omitted', () => {
    expect(resolveBridgeKycEndorsements(undefined)).toEqual(
      DEFAULT_BRIDGE_KYC_ENDORSEMENTS,
    );
    expect(resolveBridgeKycEndorsements([])).toEqual(
      DEFAULT_BRIDGE_KYC_ENDORSEMENTS,
    );
  });

  it('parses explicit selections', () => {
    expect(resolveBridgeKycEndorsements(['sepa', 'pix'])).toEqual([
      'sepa',
      'pix',
    ]);
  });
});
