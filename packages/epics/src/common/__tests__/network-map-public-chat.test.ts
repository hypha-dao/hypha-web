import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sidePanel = readFileSync(
  resolve(__dirname, '../../spaces/components/network-side-panel.tsx'),
  'utf8',
);
const headerTrigger = readFileSync(
  resolve(__dirname, '../panel-wrap-layout.tsx'),
  'utf8',
);
const openPublicChatHook = readFileSync(
  resolve(__dirname, '../use-open-space-public-chat.ts'),
  'utf8',
);
const humanRightPanel = readFileSync(
  resolve(__dirname, '../human-right-panel.tsx'),
  'utf8',
);

describe('all-spaces map chat entry points', () => {
  it('opens the public channel from the map Connect button', () => {
    expect(sidePanel).toContain('useOpenSpacePublicChat');
    expect(sidePanel).toContain('void openPublicChat({');
    expect(sidePanel).toContain('slug: focusedSlug');
    expect(sidePanel).toContain('memberRoomId: focusedRoomId');
    expect(sidePanel).not.toMatch(/openCoherenceChat\(\s*focusedRoomId/);
    expect(sidePanel).toContain("error === 'matrix'");
    expect(sidePanel).toContain("tCommon('signIn')");
    expect(sidePanel).toContain("tChat('failedToJoinRoom')");
    expect(sidePanel).not.toContain('alert(');
  });

  it('opens the public channel from the header icon for a map-selected space', () => {
    expect(headerTrigger).toContain('useOpenSpacePublicChat');
    expect(headerTrigger).toContain('if (focusedSpaceChat?.slug)');
    expect(headerTrigger).toContain('void openPublicChat({');
    expect(headerTrigger).toContain('slug: focusedSpaceChat.slug');
    expect(headerTrigger).toContain('memberRoomId: focusedSpaceChat.roomId');
    expect(headerTrigger).not.toMatch(
      /openCoherenceChat\(\s*focusedSpaceChat\.roomId/,
    );
    expect(headerTrigger).toContain("publicChatError === 'matrix'");
    expect(headerTrigger).toContain("tCommon('signIn')");
    expect(headerTrigger).toContain("t('failedToJoinRoom')");
    expect(headerTrigger).not.toContain('alert(');
  });

  it('refuses a public alias that still points at the member room', () => {
    expect(openPublicChatHook).toContain(
      'ensurePublicRoom(slug, memberRoomId)',
    );
    expect(openPublicChatHook).toContain('acceptEnsuredPublicRoomId(');
    expect(openPublicChatHook).toContain(
      "throw new Error('Public channel resolved to the space channel')",
    );
    expect(humanRightPanel).toContain('if (coherencePublic)');
    expect(humanRightPanel).toContain(
      'await matrixRef.current.ensurePublicRoom(',
    );
    expect(humanRightPanel).toContain('acceptEnsuredPublicRoomId(');
    expect(humanRightPanel).toContain('!coherencePublic &&');
    expect(humanRightPanel).toContain(
      '} else if (!targetRoomId && openingSpaceSlug) {',
    );
    expect(humanRightPanel).toContain(
      "{t('publicRoomTitle')} — {t('publicWelcome')}",
    );
  });
});
