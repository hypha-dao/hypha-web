import { describe, expect, it } from 'vitest';

import { DEFAULT_SPACE_AVATAR_IMAGE } from '../../../../../core/src/assets/constant';

import { calledAgentAvatarUrl } from '../matrix-member-avatar';

describe('calledAgentAvatarUrl', () => {
  it('uses the Matrix profile picture the way Signals does', () => {
    expect(
      calledAgentAvatarUrl({
        matrixAvatarUrl: 'https://matrix.example/bot',
        spaceLogoUrl: 'https://cdn.example/space.png',
      }),
    ).toBe('https://matrix.example/bot');
  });

  it('uses the space logo when the bot has no Matrix photo', () => {
    expect(
      calledAgentAvatarUrl({
        matrixAvatarUrl: '  ',
        spaceLogoUrl: 'https://cdn.example/space.png',
      }),
    ).toBe('https://cdn.example/space.png');
  });

  it('uses the same default mark as the @ row when neither photo exists', () => {
    expect(
      calledAgentAvatarUrl({
        matrixAvatarUrl: null,
        spaceLogoUrl: null,
      }),
    ).toBe(DEFAULT_SPACE_AVATAR_IMAGE);
  });
});
