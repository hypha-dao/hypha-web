import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../panel-wrap-layout.tsx'),
  'utf8',
);

describe('chat panel open from Messages', () => {
  it('sets the right panel open instead of toggling it', () => {
    expect(source).toContain('openHumanChatPanel()');
    expect(source).toContain('closeHumanChatPanel()');
    expect(source).not.toContain('if (open !== rightOpen) toggleRight()');
  });
});
