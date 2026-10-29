import { describe, expect, it } from 'vitest';

import {
  messagesFrameHeight,
  messagesListFrameHeight,
} from '../messages-frame-height';

describe('messagesFrameHeight', () => {
  it('fills to the viewport bottom so the footer stays below the fold', () => {
    expect(
      messagesFrameHeight({
        frameTop: 100,
        scrollBottom: 900,
        viewportBottom: 900,
        tabOffset: 0,
      }),
    ).toBe(800);
  });

  it('still accounts for the phone tab bar', () => {
    expect(
      messagesFrameHeight({
        frameTop: 80,
        scrollBottom: 800,
        viewportBottom: 800,
        tabOffset: 96,
      }),
    ).toBe(624);
  });
});

describe('messagesListFrameHeight', () => {
  it('fills the pinned column so the list can scroll', () => {
    expect(messagesListFrameHeight({ available: 640 })).toBe(640);
  });

  it('keeps a usable minimum when the column is short', () => {
    expect(messagesListFrameHeight({ available: 40 })).toBe(160);
  });
});
