import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const panel = readFileSync(
  resolve(__dirname, '../human-right-panel.tsx'),
  'utf8',
);

describe('group chat header faces', () => {
  it('uses overlapping GroupFaces in the panel header for groups', () => {
    expect(panel).toContain('groupChatFaces');
    expect(panel).toContain('isDirectConversation && groupChatFaces ? (');
    expect(panel).toContain(
      '<GroupFaces faces={groupChatFaces} size="header" />',
    );
    expect(panel).toContain("from '../people/components/group-faces'");
  });

  it('resolves header faces like the Messages list (getUser + Hypha roster)', () => {
    expect(panel).toContain('client.getUser(userId)?.avatarUrl');
    expect(panel).toContain('resolveMemberAvatar(userId)');
    // DM group peers come from roomPeopleBySub, not only the space roster.
    expect(panel).toContain('roomPeopleBySub.get(localpartSub)?.avatarUrl');
    expect(panel).toContain('roomPeopleBySub.get(sub)');
    // Same mxcUrlToHttp shape as Messages `avatarHttp` — not the auth-media arity.
    expect(panel).toMatch(
      /function matrixMemberAvatarSquare[\s\S]*?mxcUrlToHttp\(mxc, px, px, 'crop'\)/,
    );
  });
});
