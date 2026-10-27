import { describe, expect, it, vi } from 'vitest';

import {
  actionForRequiredRoomTypeLookup,
  classifyRequiredRoomType,
  lookupRequiredRoomType,
} from '../required-room-type';

describe('lookupRequiredRoomType', () => {
  it('does not detach or delete an alias when the type lookup throws', async () => {
    const onError = vi.fn();
    await expect(
      lookupRequiredRoomType(
        () => Promise.reject(new Error('homeserver timeout')),
        'io.hypha.room.space-public',
        onError,
      ),
    ).resolves.toBe('unknown');
    expect(onError).toHaveBeenCalledOnce();
    expect(actionForRequiredRoomTypeLookup('unknown')).toBe('abort');
    expect(actionForRequiredRoomTypeLookup('unknown', true)).toBe('abort');
  });

  it('classifies a successful type read as match or mismatch', async () => {
    await expect(
      lookupRequiredRoomType(
        async () => 'io.hypha.room.space-public',
        'io.hypha.room.space-public',
      ),
    ).resolves.toBe('match');
    await expect(
      lookupRequiredRoomType(
        async () => 'io.hypha.room.space',
        'io.hypha.room.space-public',
      ),
    ).resolves.toBe('mismatch');
    expect(
      classifyRequiredRoomType(
        'io.hypha.room.space-public',
        'io.hypha.room.space-public',
      ),
    ).toBe('match');
  });
});

describe('actionForRequiredRoomTypeLookup', () => {
  it('detaches only after a confirmed type mismatch or member-room id', () => {
    expect(actionForRequiredRoomTypeLookup('mismatch')).toBe('detach');
    expect(actionForRequiredRoomTypeLookup('match', true)).toBe('detach');
    expect(actionForRequiredRoomTypeLookup('match')).toBe('keep');
  });
});
