import { describe, expect, it } from 'vitest';

import { distinctPublicRoomId } from '../public-room-id';

describe('distinctPublicRoomId', () => {
  it('keeps a public room that is not the member room', () => {
    expect(distinctPublicRoomId('!public:hs', '!space:hs')).toBe('!public:hs');
  });

  it('rejects the member room so the public channel cannot show it', () => {
    expect(distinctPublicRoomId('!space:hs', '!space:hs')).toBeNull();
    expect(distinctPublicRoomId('  !space:hs  ', '!space:hs')).toBeNull();
  });

  it('allows any resolved room when the member room is unknown', () => {
    expect(distinctPublicRoomId('!public:hs', null)).toBe('!public:hs');
    expect(distinctPublicRoomId('!public:hs', '   ')).toBe('!public:hs');
  });

  it('returns null when the alias did not resolve', () => {
    expect(distinctPublicRoomId(null, '!space:hs')).toBeNull();
    expect(distinctPublicRoomId('  ', '!space:hs')).toBeNull();
  });
});
