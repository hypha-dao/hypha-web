import { describe, expect, it } from 'vitest';

import {
  messagesListFrameHeight,
  messagesVisibleViewportHeight,
} from '../messages-frame-height';

describe('messagesListFrameHeight', () => {
  it('caps the list to the viewport under the sticky menu gap', () => {
    expect(
      messagesListFrameHeight({
        viewportBottom: 900,
        menuOffset: 72,
        tabOffset: 0,
      }),
    ).toBe(816);
  });

  it('still accounts for the phone tab bar', () => {
    expect(
      messagesListFrameHeight({
        viewportBottom: 800,
        menuOffset: 64,
        tabOffset: 96,
      }),
    ).toBe(628);
  });
});

describe('messagesVisibleViewportHeight', () => {
  it('uses the smaller of the layout and visual heights', () => {
    expect(
      messagesVisibleViewportHeight({
        innerHeight: 900,
        visualHeight: 1400,
      }),
    ).toBe(900);
  });

  it('ignores a hidden or collapsed window', () => {
    expect(
      messagesVisibleViewportHeight({
        innerHeight: 900,
        visualHeight: 900,
        hidden: true,
      }),
    ).toBeNull();
    expect(
      messagesVisibleViewportHeight({
        innerHeight: 0,
        visualHeight: 0,
      }),
    ).toBeNull();
  });
});
