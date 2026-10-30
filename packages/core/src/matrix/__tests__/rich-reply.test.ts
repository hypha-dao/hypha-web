import { describe, expect, it } from 'vitest';
import type * as MatrixSdk from 'matrix-js-sdk';

import {
  buildRichReplyPlainBody,
  firstLineForReplyPreview,
  isLocalProvisionalEventId,
  messageFromRoomMessageEvent,
  stripMatrixReplyFallback,
  truncateForPreview,
} from '../rich-reply';

describe('stripMatrixReplyFallback', () => {
  it('removes quoted block before double newline', () => {
    const body = `> <@a:b> hi\n> there\n\nmy reply`;
    expect(stripMatrixReplyFallback(body)).toBe('my reply');
  });

  it('strips nested reply parent so preview is only the visible line', () => {
    const nestedParent = `> <@u:h> hello\n> there\n\nhey`;
    expect(stripMatrixReplyFallback(nestedParent).trim()).toBe('hey');
  });

  it('returns original when no reply structure', () => {
    expect(stripMatrixReplyFallback('plain')).toBe('plain');
  });
});

describe('isLocalProvisionalEventId', () => {
  it('detects provisional client ids', () => {
    expect(
      isLocalProvisionalEventId(
        '~!EbLD2GFiUPLzqn6N:srv1294735.hstgr.cloud:m1775513342375.0',
      ),
    ).toBe(true);
  });

  it('does not flag server ids', () => {
    expect(isLocalProvisionalEventId('$abc:example.com')).toBe(false);
  });
});

describe('firstLineForReplyPreview', () => {
  it('returns only the first line', () => {
    expect(firstLineForReplyPreview('a\nb\nc')).toBe('a');
  });

  it('truncates long first line', () => {
    const long = 'x'.repeat(150);
    expect(firstLineForReplyPreview(long, 10).length).toBe(10);
    expect(firstLineForReplyPreview(long, 10).endsWith('…')).toBe(true);
  });
});

describe('truncateForPreview', () => {
  it('truncates long text', () => {
    const s = 'a'.repeat(300);
    expect(truncateForPreview(s, 10).length).toBe(10);
    expect(truncateForPreview(s, 10).endsWith('…')).toBe(true);
  });
});

describe('buildRichReplyPlainBody', () => {
  it('builds Matrix-style quoted fallback', () => {
    const out = buildRichReplyPlainBody('@u:h', 'hello', 'world');
    expect(out).toContain('> <@u:h> hello');
    expect(out).toContain('\n\nworld');
  });

  it('does not nest an existing reply fallback from the parent body', () => {
    const parent = `> <@a:b> hi\n\nhello`;
    const out = buildRichReplyPlainBody('@u:h', parent, 'world');
    expect(out).toContain('> <@u:h> hello');
    expect(out).not.toContain('> <@u:h> > <@a:b> hi');
  });
});

describe('messageFromRoomMessageEvent edited', () => {
  function makeTextEvent(opts: {
    replacingEventId?: string;
    /** Local-echo replace attached before the edit event has a final id. */
    hasReplacingEvent?: boolean;
    body?: string;
  }): MatrixSdk.MatrixEvent {
    return {
      getId: () => '$msg:example.com',
      getSender: () => '@you:example.com',
      getTs: () => 1_700_000_000_000,
      getContent: () => ({
        msgtype: 'm.text',
        body: opts.body ?? 'Hello',
      }),
      getWireContent: () => ({
        msgtype: 'm.text',
        body: opts.body ?? 'Hello',
      }),
      replacingEventId: () => opts.replacingEventId,
      replacingEvent: () =>
        opts.hasReplacingEvent || opts.replacingEventId
          ? ({
              getId: () => opts.replacingEventId ?? null,
            } as MatrixSdk.MatrixEvent)
          : null,
    } as unknown as MatrixSdk.MatrixEvent;
  }

  it('marks a replaced root as edited', () => {
    const client = {
      getRoom: () => null,
    } as unknown as MatrixSdk.MatrixClient;
    const message = messageFromRoomMessageEvent(
      client,
      '!room:example.com',
      makeTextEvent({ replacingEventId: '$edit:example.com', body: 'Updated' }),
      false,
    );
    expect(message.edited).toBe(true);
    expect(message.content).toBe('Updated');
  });

  it('marks local-echo edits as edited when the replace id is not final yet', () => {
    const client = {
      getRoom: () => null,
    } as unknown as MatrixSdk.MatrixClient;
    const message = messageFromRoomMessageEvent(
      client,
      '!room:example.com',
      makeTextEvent({ hasReplacingEvent: true, body: 'Updated' }),
      false,
    );
    expect(message.edited).toBe(true);
  });

  it('omits edited when there is no replacement', () => {
    const client = {
      getRoom: () => null,
    } as unknown as MatrixSdk.MatrixClient;
    const message = messageFromRoomMessageEvent(
      client,
      '!room:example.com',
      makeTextEvent({}),
      false,
    );
    expect(message.edited).toBeUndefined();
  });
});
