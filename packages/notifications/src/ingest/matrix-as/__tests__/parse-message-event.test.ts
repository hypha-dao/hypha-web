import { describe, expect, it } from 'vitest';
import { parseMessageEvent } from '../parse-message-event';
import type { MatrixEvent } from '../types';

const base: MatrixEvent = {
  type: 'm.room.message',
  event_id: '$evt1',
  room_id: '!room:hs',
  sender: '@alice:hs',
  origin_server_ts: 1_700_000_000_000,
  content: { msgtype: 'm.text', body: 'hello world' },
};

describe('parseMessageEvent', () => {
  it('normalises a plain text message', () => {
    expect(parseMessageEvent(base)).toEqual({
      matrixEventId: '$evt1',
      roomId: '!room:hs',
      senderMxid: '@alice:hs',
      body: 'hello world',
      mentionedMatrixUserIds: [],
      occurredAt: 1_700_000_000_000,
    });
  });

  it('drops non-message events (state, membership, reactions, call state)', () => {
    for (const type of [
      'm.room.member',
      'm.reaction',
      'm.room.redaction',
      'org.matrix.msc3401.call.member',
      'm.room.power_levels',
    ]) {
      expect(parseMessageEvent({ ...base, type })).toBeNull();
    }
  });

  it('drops m.notice (bot/automation echoes)', () => {
    expect(
      parseMessageEvent({
        ...base,
        content: { msgtype: 'm.notice', body: 'automated' },
      }),
    ).toBeNull();
  });

  it('drops events missing event_id / room_id / sender', () => {
    expect(parseMessageEvent({ ...base, event_id: undefined })).toBeNull();
    expect(parseMessageEvent({ ...base, room_id: '  ' })).toBeNull();
    expect(parseMessageEvent({ ...base, sender: undefined })).toBeNull();
  });

  it('reads mentions from m.mentions.user_ids (MSC3952)', () => {
    const parsed = parseMessageEvent({
      ...base,
      content: {
        msgtype: 'm.text',
        body: 'hey you two',
        ['m.mentions']: { user_ids: ['@bob:hs', '@carol:hs', ' @bob:hs '] },
      },
    });
    expect(parsed?.mentionedMatrixUserIds).toEqual(['@bob:hs', '@carol:hs']);
  });

  it('falls back to matrix.to pills in the formatted body', () => {
    const parsed = parseMessageEvent({
      ...base,
      content: {
        msgtype: 'm.text',
        body: 'hey Bob',
        format: 'org.matrix.custom.html',
        formatted_body:
          'hey <a href="https://matrix.to/#/@bob:hs">Bob</a> and ' +
          '<a href="https://matrix.to/#/%40carol%3Ahs">Carol</a>',
      },
    });
    expect(parsed?.mentionedMatrixUserIds.sort()).toEqual([
      '@bob:hs',
      '@carol:hs',
    ]);
  });

  it('prefers m.mentions over pill parsing when both exist', () => {
    const parsed = parseMessageEvent({
      ...base,
      content: {
        msgtype: 'm.text',
        body: 'x',
        ['m.mentions']: { user_ids: ['@bob:hs'] },
        formatted_body: '<a href="https://matrix.to/#/@carol:hs">Carol</a>',
      },
    });
    expect(parsed?.mentionedMatrixUserIds).toEqual(['@bob:hs']);
  });

  it('defaults body to empty string and ts to now when absent', () => {
    const parsed = parseMessageEvent({
      type: 'm.room.message',
      event_id: '$e',
      room_id: '!r:hs',
      sender: '@a:hs',
      content: { msgtype: 'm.image' },
    });
    expect(parsed?.body).toBe('');
    expect(parsed?.occurredAt).toBeGreaterThan(0);
  });
});
