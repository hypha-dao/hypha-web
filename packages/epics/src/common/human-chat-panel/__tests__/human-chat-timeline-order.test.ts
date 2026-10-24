import { describe, expect, it } from 'vitest';

import {
  compareMessagesChronologically,
  shouldStickChatTimelineToBottom,
  sortMessagesChronologically,
  upsertTimelineMessages,
} from '../human-chat-timeline-order';

const msg = (id: string, ts: number | null) => ({
  id,
  timestamp: ts == null ? undefined : new Date(ts),
  body: id,
});

describe('compareMessagesChronologically', () => {
  it('orders by timestamp oldest to newest', () => {
    expect(
      compareMessagesChronologically(msg('$a', 200), msg('$b', 100)),
    ).toBeGreaterThan(0);
    expect(
      compareMessagesChronologically(msg('$a', 100), msg('$b', 200)),
    ).toBeLessThan(0);
  });

  it('keeps pending rows (no timestamp) after dated messages', () => {
    expect(
      compareMessagesChronologically(msg('pending', null), msg('$a', 100)),
    ).toBeGreaterThan(0);
  });
});

describe('upsertTimelineMessages', () => {
  it('inserts an older backfill event before the newest-first paint', () => {
    const newestFirst = [msg('$new', 300), msg('$newer', 400)];
    const merged = upsertTimelineMessages(newestFirst, [msg('$old', 100)]);
    expect(merged.map((row) => row.id)).toEqual(['$old', '$new', '$newer']);
  });

  it('reorders two live events that arrive newest-first', () => {
    const merged = upsertTimelineMessages(
      [],
      [msg('$later', 200), msg('$earlier', 100)],
    );
    expect(merged.map((row) => row.id)).toEqual(['$earlier', '$later']);
  });

  it('replaces an existing id in place and re-sorts if the time changes', () => {
    const prev = [msg('$a', 100), msg('$b', 200)];
    const merged = upsertTimelineMessages(prev, [
      { id: '$b', timestamp: new Date(50), body: 'edited-time' },
    ]);
    expect(merged.map((row) => row.id)).toEqual(['$b', '$a']);
    expect(merged[0]?.body).toBe('edited-time');
  });

  it('keeps a pending send after every dated message', () => {
    const merged = upsertTimelineMessages(
      [msg('$a', 100), msg('hypha-send-pending', null)],
      [msg('$b', 200)],
    );
    expect(merged.map((row) => row.id)).toEqual([
      '$a',
      '$b',
      'hypha-send-pending',
    ]);
  });
});

describe('sortMessagesChronologically', () => {
  it('does not mutate the input array', () => {
    const input = [msg('$b', 200), msg('$a', 100)];
    const sorted = sortMessagesChronologically(input);
    expect(input.map((row) => row.id)).toEqual(['$b', '$a']);
    expect(sorted.map((row) => row.id)).toEqual(['$a', '$b']);
  });
});

describe('shouldStickChatTimelineToBottom', () => {
  it('does not jump when the user is scrolled up and someone else posts', () => {
    expect(
      shouldStickChatTimelineToBottom({
        alreadyStuckToBottom: false,
        newestMessageIsOwn: false,
        isStreaming: false,
      }),
    ).toBe(false);
  });

  it('sticks when the user sends, even if they were scrolled up', () => {
    expect(
      shouldStickChatTimelineToBottom({
        alreadyStuckToBottom: false,
        newestMessageIsOwn: true,
        isStreaming: false,
      }),
    ).toBe(true);
  });

  it('keeps following the bottom when already stuck', () => {
    expect(
      shouldStickChatTimelineToBottom({
        alreadyStuckToBottom: true,
        newestMessageIsOwn: false,
        isStreaming: false,
      }),
    ).toBe(true);
  });
});
