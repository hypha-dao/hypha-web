import { describe, expect, it } from 'vitest';

import { decodeSignalSlug, signalBelongsToSpace } from '../signal';

describe('signal detail checks', () => {
  it('a signal of this Space passes', () => {
    expect(signalBelongsToSpace({ spaceId: 4 }, { id: 4 })).toBe(true);
  });

  it("another Space's signal fails (answered like an unknown slug)", () => {
    expect(signalBelongsToSpace({ spaceId: 9 }, { id: 4 })).toBe(false);
  });

  it('an unknown signal or Space fails closed', () => {
    expect(signalBelongsToSpace(undefined, { id: 4 })).toBe(false);
    expect(signalBelongsToSpace(null, { id: 4 })).toBe(false);
    expect(signalBelongsToSpace({ spaceId: 4 }, null)).toBe(false);
    expect(signalBelongsToSpace({ spaceId: null }, { id: 4 })).toBe(false);
    expect(signalBelongsToSpace({}, { id: 4 })).toBe(false);
  });

  it('decodes the slug and tolerates a malformed escape', () => {
    expect(decodeSignalSlug('a%20b ')).toBe('a b');
    expect(decodeSignalSlug('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
