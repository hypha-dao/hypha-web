import { describe, expect, it } from 'vitest';

import {
  directPairAliasLocalpart,
  isDirectPairRoom,
  isSignalThreadMessageContent,
  pickDirectPairRoom,
} from '../direct-pair-room';

const alex = '@alex:hypha.earth';
const gerardo = '@gerardo:hypha.earth';
const bot = '@hypha-bot:hypha.earth';

describe('direct pair room', () => {
  it('uses one alias no matter who opens the chat', () => {
    expect(directPairAliasLocalpart(alex, gerardo)).toBe(
      directPairAliasLocalpart(gerardo, alex),
    );
    expect(directPairAliasLocalpart(alex, gerardo)).toMatch(
      /^hypha-dm-[0-9a-f]{32}$/,
    );
  });

  it('accepts the room even when the other person is only invited', () => {
    expect(
      isDirectPairRoom([alex, bot], alex, gerardo, (id) => id === bot),
    ).toBe(true);
    expect(
      isDirectPairRoom([alex, gerardo, bot], alex, gerardo, (id) => id === bot),
    ).toBe(true);
  });

  it('refuses a group room', () => {
    expect(
      isDirectPairRoom(
        [alex, gerardo, '@vlad:hypha.earth', bot],
        alex,
        gerardo,
        (id) => id === bot,
      ),
    ).toBe(false);
  });

  it('keeps a signal thread out of the direct room', () => {
    expect(
      isSignalThreadMessageContent({ coherenceSlug: 'fund-the-cohort' }),
    ).toBe(true);
    expect(isSignalThreadMessageContent({ body: 'Hey' })).toBe(false);
  });

  it('keeps the room with the later message', () => {
    expect(
      pickDirectPairRoom([
        { roomId: '!older:hs', lastMessageTs: 10 },
        { roomId: '!newer:hs', lastMessageTs: 20 },
      ]),
    ).toBe('!newer:hs');
  });
});
