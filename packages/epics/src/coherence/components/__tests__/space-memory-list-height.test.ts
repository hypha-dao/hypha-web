import { describe, expect, it } from 'vitest';

import { spaceMemoryListHeight } from '../space-memory-list-height';

describe('spaceMemoryListHeight', () => {
  it('caps the list to the viewport under the sticky menu gap', () => {
    expect(
      spaceMemoryListHeight({
        viewportBottom: 900,
        menuOffset: 72,
        tabOffset: 0,
      }),
    ).toBe(816);
  });

  it('leaves room for the phone tab bar', () => {
    expect(
      spaceMemoryListHeight({
        viewportBottom: 800,
        menuOffset: 64,
        tabOffset: 96,
      }),
    ).toBe(628);
  });
});
