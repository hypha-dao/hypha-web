import { describe, expect, it, vi } from 'vitest';

import { applyMediaEditCaptionAndReply } from '../edit-room-message-media-caption';
import { MATRIX_CUSTOM_HTML_FORMAT } from '../rich-reply';

/** Covers `editRoomMessage` media branch in matrix-provider (empty caption + reply). */
describe('applyMediaEditCaptionAndReply', () => {
  it('preserves m.in_reply_to when caption is cleared but replyToId is set', async () => {
    const combined = {
      msgtype: 'm.image',
      body: 'photo.png',
      filename: 'photo.png',
      url: 'mxc://hs/a',
    };
    const resolveReply = vi.fn().mockResolvedValue({
      eventId: '$parent:example.org',
      sender: '@alice:example.org',
      body: 'original',
    });

    const out = await applyMediaEditCaptionAndReply(
      combined,
      '',
      '$reply:event',
      resolveReply,
      'photo.png',
    );

    expect(resolveReply).toHaveBeenCalledWith('$reply:event');
    expect(out['m.relates_to']).toEqual({
      'm.in_reply_to': { event_id: '$parent:example.org' },
    });
    expect(out.format).toBe(MATRIX_CUSTOM_HTML_FORMAT);
    expect(typeof out.formatted_body).toBe('string');
    expect(out.formatted_body!.length).toBeGreaterThan(0);
    expect(out.body).toContain('> <@alice:example.org>');
    expect(out.body).toContain('original');
  });

  it('uses filename fallback when caption and reply are absent', async () => {
    const combined = {
      msgtype: 'm.image',
      body: 'x',
      filename: 'x',
      url: 'mxc://hs/b',
    };
    const resolveReply = vi.fn();

    const out = await applyMediaEditCaptionAndReply(
      combined,
      '',
      undefined,
      resolveReply,
      'fallback.png',
    );

    expect(resolveReply).not.toHaveBeenCalled();
    expect(out.body).toBe('fallback.png');
    expect(out['m.relates_to']).toBeUndefined();
  });
});
