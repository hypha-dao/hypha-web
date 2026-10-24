import { describe, expect, it } from 'vitest';

import {
  composerKeyInsertsNewline,
  composerKeySendsMessage,
} from '../composer-enter';
import { visualViewportKeyboardInset } from '../visual-viewport-keyboard';

describe('composer Enter', () => {
  it('sends on web Enter and newlines on Shift+Enter', () => {
    expect(
      composerKeySendsMessage({
        key: 'Enter',
        shiftKey: false,
        isTouchComposer: false,
      }),
    ).toBe(true);
    expect(
      composerKeyInsertsNewline({
        key: 'Enter',
        shiftKey: true,
        isTouchComposer: false,
      }),
    ).toBe(true);
    expect(
      composerKeySendsMessage({
        key: 'Enter',
        shiftKey: true,
        isTouchComposer: false,
      }),
    ).toBe(false);
  });

  it('inserts a newline on mobile Enter so bullets stay one message', () => {
    const afterFirstBullet = {
      key: 'Enter',
      shiftKey: false,
      isTouchComposer: true,
    };
    expect(composerKeySendsMessage(afterFirstBullet)).toBe(false);
    expect(composerKeyInsertsNewline(afterFirstBullet)).toBe(true);
    expect(
      composerKeySendsMessage({
        key: 'Enter',
        shiftKey: true,
        isTouchComposer: true,
      }),
    ).toBe(false);
  });

  it('ignores keys other than Enter', () => {
    expect(
      composerKeySendsMessage({
        key: 'a',
        shiftKey: false,
        isTouchComposer: false,
      }),
    ).toBe(false);
  });
});

describe('visualViewportKeyboardInset', () => {
  it('returns the covered layout pixels', () => {
    expect(visualViewportKeyboardInset(800, 500, 0)).toBe(300);
    expect(visualViewportKeyboardInset(800, 500, 40)).toBe(260);
  });

  it('is zero when the visual viewport fills the layout', () => {
    expect(visualViewportKeyboardInset(800, 800, 0)).toBe(0);
    expect(visualViewportKeyboardInset(800, 820, 0)).toBe(0);
  });
});
