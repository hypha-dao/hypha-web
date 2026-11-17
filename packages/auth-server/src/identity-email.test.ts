import { describe, expect, it } from 'vitest';
import { syntheticEmail } from './identity-bridge';

describe('syntheticEmail', () => {
  it('is unique per person and never a real address', () => {
    const a = syntheticEmail('did:privy:abc');
    const b = syntheticEmail('did:privy:abd');
    expect(a).not.toBe(b);
    expect(a.endsWith('@users.invalid')).toBe(true);
    expect(a).not.toContain(' ');
  });
  it('ids that differ only in letter case stay distinct', () => {
    expect(syntheticEmail('did:privy:AbC')).not.toBe(
      syntheticEmail('did:privy:abc'),
    );
  });
});
