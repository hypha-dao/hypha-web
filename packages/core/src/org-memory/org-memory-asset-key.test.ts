import { describe, expect, it } from 'vitest';
import {
  parseOrgMemoryAssetKey,
  serializeOrgMemoryAssetKey,
} from './org-memory-asset-key';

describe('org-memory-asset-key', () => {
  it('round-trips proposal key', () => {
    const p = { k: 'p' as const, d: 42, u: 'https://example.com/f.pdf' };
    const s = serializeOrgMemoryAssetKey(p);
    expect(parseOrgMemoryAssetKey(s)).toEqual(p);
  });

  it('round-trips matrix key', () => {
    const p = {
      k: 'm' as const,
      r: '!room:matrix.org',
      e: '$ev1',
      x: 'mxc://homeserver/mediaid',
    };
    const s = serializeOrgMemoryAssetKey(p);
    expect(parseOrgMemoryAssetKey(s)).toEqual(p);
  });
});
