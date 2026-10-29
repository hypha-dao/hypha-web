import { describe, expect, it } from 'vitest';

import { spaceMemoryListHeight } from '../space-memory-list-height';

describe('spaceMemoryListHeight', () => {
  it('fills the visible column under the filters', () => {
    expect(
      spaceMemoryListHeight({
        frameTop: 280,
        scrollBottom: 900,
        viewportBottom: 900,
        tabOffset: 0,
      }),
    ).toBe(620);
  });

  it('leaves room for the phone tab bar', () => {
    expect(
      spaceMemoryListHeight({
        frameTop: 200,
        scrollBottom: 800,
        viewportBottom: 800,
        tabOffset: 96,
      }),
    ).toBe(504);
  });
});
