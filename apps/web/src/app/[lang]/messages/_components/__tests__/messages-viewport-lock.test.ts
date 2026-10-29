import { describe, expect, it } from 'vitest';

import { messagesListFrameHeight } from '../messages-frame-height';

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
