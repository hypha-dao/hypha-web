import { describe, expect, it } from 'vitest';

import { shouldCloseSignalDetailChat } from '../signal-detail-chat';

describe('shouldCloseSignalDetailChat', () => {
  it('closes when the open panel is this signal', () => {
    expect(
      shouldCloseSignalDetailChat({
        mode: 'coherence',
        chatSlug: 'road-repair',
        signalSlug: 'road-repair',
      }),
    ).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(
      shouldCloseSignalDetailChat({
        mode: 'coherence',
        chatSlug: ' road-repair ',
        signalSlug: 'road-repair',
      }),
    ).toBe(true);
  });

  it('leaves a different thread open', () => {
    expect(
      shouldCloseSignalDetailChat({
        mode: 'coherence',
        chatSlug: 'other-signal',
        signalSlug: 'road-repair',
      }),
    ).toBe(false);
  });

  it('leaves the space chat open', () => {
    expect(
      shouldCloseSignalDetailChat({
        mode: 'space',
        chatSlug: 'road-repair',
        signalSlug: 'road-repair',
      }),
    ).toBe(false);
  });

  it('does nothing without a signal slug', () => {
    expect(
      shouldCloseSignalDetailChat({
        mode: 'coherence',
        chatSlug: 'road-repair',
        signalSlug: '  ',
      }),
    ).toBe(false);
  });
});
