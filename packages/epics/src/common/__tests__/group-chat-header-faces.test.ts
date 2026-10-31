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
});
