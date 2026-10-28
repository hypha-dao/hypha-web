import { describe, expect, it } from 'vitest';

import { messagesFrameHeight } from '../messages-frame-height';

describe('messagesFrameHeight', () => {
  it('leaves room for the desktop site footer while the column is locked', () => {
    expect(
      messagesFrameHeight({
        frameTop: 100,
        scrollBottom: 900,
        viewportBottom: 900,
        tabOffset: 0,
        footerOffset: 72,
      }),
    ).toBe(728);
  });

  it('still accounts for the phone tab bar', () => {
    expect(
      messagesFrameHeight({
        frameTop: 80,
        scrollBottom: 800,
        viewportBottom: 800,
        tabOffset: 96,
        footerOffset: 0,
      }),
    ).toBe(624);
  });
});
