import { describe, expect, it } from 'vitest';

import {
  dedupeTimelineMessages,
  timelineMessagesForPersistence,
} from '../timeline-message-dedupe';

const text = (
  id: string,
  body: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  role: 'member' as const,
  senderMatrixId: '@a:example',
  timestamp: new Date(1_000),
  parts: [{ type: 'text', text: body }],
  ...extra,
});

describe('dedupeTimelineMessages', () => {
  it('drops a local echo once the homeserver copy is present', () => {
    const merged = dedupeTimelineMessages([
      text('~local', 'Hello', { sendAcknowledged: false }),
      text('$real', 'Hello', { sendAcknowledged: true }),
    ]);
    expect(merged.map((row) => row.id)).toEqual(['$real']);
  });

  it('drops an empty unacknowledged copy beside the real message', () => {
    const merged = dedupeTimelineMessages(
      [
        text('~local', '', {
          sendAcknowledged: false,
          role: 'user',
          senderMatrixId: '@me:example',
        }),
        text('$real', 'Hello', {
          role: 'user',
          senderMatrixId: '@me:example',
        }),
      ],
      '@me:example',
    );
    expect(merged.map((row) => row.id)).toEqual(['$real']);
  });

  it('keeps two different acknowledged messages', () => {
    const merged = dedupeTimelineMessages([
      text('$a', 'Hello'),
      text('$b', 'Hello again', { timestamp: new Date(2_000) }),
    ]);
    expect(merged.map((row) => row.id)).toEqual(['$a', '$b']);
  });

  it('keeps a captionless pending upload beside an older text message', () => {
    const merged = dedupeTimelineMessages(
      [
        {
          id: 'hypha-send-pending-1',
          role: 'user' as const,
          sendPending: {},
          parts: [],
          media: { mxcUrl: '' },
        },
        text('$real', 'Hello', {
          role: 'user',
          senderMatrixId: '@me:example',
          timestamp: new Date(1_000),
        }),
      ],
      '@me:example',
    );
    expect(merged.map((row) => row.id)).toEqual([
      'hypha-send-pending-1',
      '$real',
    ]);
  });

  it('keeps two captionless attachments that are different files', () => {
    const merged = dedupeTimelineMessages(
      [
        text('~local', '', {
          sendAcknowledged: false,
          role: 'user',
          senderMatrixId: '@me:example',
          media: { mxcUrl: 'mxc://example/one' },
        }),
        text('$real', '', {
          role: 'user',
          senderMatrixId: '@me:example',
          media: { mxcUrl: 'mxc://example/two' },
        }),
      ],
      '@me:example',
    );
    expect(merged.map((row) => row.id)).toEqual(['~local', '$real']);
  });

  it('drops a captionless echo once the same attachment has arrived', () => {
    const merged = dedupeTimelineMessages(
      [
        text('~local', '', {
          sendAcknowledged: false,
          role: 'user',
          senderMatrixId: '@me:example',
          media: { mxcUrl: 'mxc://example/one' },
        }),
        text('$real', '', {
          role: 'user',
          senderMatrixId: '@me:example',
          media: { mxcUrl: 'mxc://example/one' },
        }),
      ],
      '@me:example',
    );
    expect(merged.map((row) => row.id)).toEqual(['$real']);
  });

  it('drops the sending mask once the same caption has arrived', () => {
    const merged = dedupeTimelineMessages(
      [
        {
          id: 'hypha-send-pending-1',
          role: 'user' as const,
          sendPending: { captionPreview: 'Photo' },
          parts: [],
        },
        text('$real', 'Photo', { role: 'user', senderMatrixId: '@me:example' }),
      ],
      '@me:example',
    );
    expect(merged.map((row) => row.id)).toEqual(['$real']);
  });

  it('collapses two rows that share an id and keeps the one with text', () => {
    const merged = dedupeTimelineMessages([
      text('$real', '', { sendAcknowledged: false }),
      text('$real', 'Hello'),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.parts?.[0]?.text).toBe('Hello');
  });
});

describe('timelineMessagesForPersistence', () => {
  it('does not store in-flight echoes', () => {
    const stored = timelineMessagesForPersistence([
      text('~local', 'Hello', { sendAcknowledged: false }),
      text('$real', 'Hello'),
      {
        id: 'hypha-send-pending-1',
        role: 'user' as const,
        sendPending: { captionPreview: 'Hello' },
        parts: [],
      },
    ]);
    expect(stored.map((row) => row.id)).toEqual(['$real']);
  });
});
