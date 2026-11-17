import { describe, expect, it } from 'vitest';
import { classifyClient, decideConsentEntry } from './consent';

describe('classifyClient (stored provenance, never the shape of the id)', () => {
  it('reads the discovery column for cimd, the marker for dcr and registered', () => {
    expect(classifyClient({ clientDiscoveryId: 'cimd' })).toBe('cimd');
    expect(classifyClient({ registration: 'dcr' })).toBe('dcr');
    expect(classifyClient({ registration: 'registered' })).toBe('registered');
  });

  it('a row that cannot be told apart is the least trusted kind', () => {
    expect(classifyClient({})).toBe('dcr');
    expect(
      classifyClient({ registration: null, clientDiscoveryId: null }),
    ).toBe('dcr');
    expect(classifyClient({ registration: 'something-else' })).toBe('dcr');
  });

  it('a dcr marker wins over a discovery id', () => {
    expect(
      classifyClient({ registration: 'dcr', clientDiscoveryId: 'cimd' }),
    ).toBe('dcr');
  });
});

describe('decideConsentEntry', () => {
  it('a valid link without a session goes to sign-in (the page keeps the query)', () => {
    expect(decideConsentEntry('valid', false)).toBe('sign-in');
    expect(decideConsentEntry('valid', true)).toBe('show');
  });

  it('an expired or invalid link never goes to sign-in', () => {
    expect(decideConsentEntry('expired', false)).toBe('expired');
    expect(decideConsentEntry('expired', true)).toBe('expired');
    expect(decideConsentEntry('invalid', false)).toBe('restart');
    expect(decideConsentEntry('invalid', true)).toBe('restart');
  });
});
