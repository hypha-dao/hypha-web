import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../panel-wrap-layout.tsx'),
  'utf8',
);

function rightPanelSidebarOnOpenChangeBody() {
  const match = source.match(
    /open=\{rightOpen\}\s+onOpenChange=\{\(open\) => \{([\s\S]*?)\n        \}\}/,
  );
  expect(match?.[1]).toBeTruthy();
  return match![1];
}

describe('chat panel open from Messages', () => {
  it('sets the right panel open instead of toggling it', () => {
    const body = rightPanelSidebarOnOpenChangeBody();
    expect(body).toMatch(/if \(open\) \{\s*openHumanChatPanel\(\);/);
    expect(body).toMatch(/else \{\s*closeHumanChatPanel\(\);/);
    expect(body).not.toContain('toggleRight()');
    expect(body).not.toContain('if (open !== rightOpen)');
  });
});
