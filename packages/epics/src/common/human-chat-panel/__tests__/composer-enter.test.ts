import { describe, expect, it } from 'vitest';

import {
  composerKeyInsertsNewline,
  composerKeySendsMessage,
} from '../composer-enter';
import {
  composerBottomPadding,
  effectiveComposerKeyboardInset,
  stabilizeComposerKeyboardInset,
  visualViewportKeyboardInset,
} from '../visual-viewport-keyboard';

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

  it('is zero for non-finite viewport numbers', () => {
    expect(visualViewportKeyboardInset(Number.NaN, 500, 0)).toBe(0);
    expect(visualViewportKeyboardInset(800, Number.POSITIVE_INFINITY, 0)).toBe(
      0,
    );
  });
});

describe('effectiveComposerKeyboardInset', () => {
  it('is zero unless the composer is focused and the overlap looks like a keyboard', () => {
    expect(effectiveComposerKeyboardInset(180, false)).toBe(0);
    expect(effectiveComposerKeyboardInset(96, true)).toBe(0);
    expect(effectiveComposerKeyboardInset(300, true)).toBe(300);
    expect(effectiveComposerKeyboardInset(Number.NaN, true)).toBe(0);
  });
});

describe('stabilizeComposerKeyboardInset', () => {
  it('ignores visualViewport jitter once a keyboard inset is applied', () => {
    expect(stabilizeComposerKeyboardInset(300, 312)).toBe(300);
    expect(stabilizeComposerKeyboardInset(300, 0)).toBe(0);
    expect(stabilizeComposerKeyboardInset(0, 300)).toBe(300);
    expect(stabilizeComposerKeyboardInset(300, 380)).toBe(380);
  });
});

describe('composerBottomPadding', () => {
  it('takes the larger of keyboard inset and the safe-area inset', () => {
    expect(composerBottomPadding(300)).toBe(
      'calc(0.5rem + max(300px, env(safe-area-inset-bottom, 0px)))',
    );
    expect(composerBottomPadding(0)).toBe(
      'calc(0.5rem + max(0px, env(safe-area-inset-bottom, 0px)))',
    );
    expect(composerBottomPadding(Number.NaN)).toBe(
      'calc(0.5rem + max(0px, env(safe-area-inset-bottom, 0px)))',
    );
  });
});
