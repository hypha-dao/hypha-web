import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = resolve(__dirname, '..');
const read = (file: string) => readFileSync(resolve(dir, file), 'utf8');

describe('emoji picker layout', () => {
  it('opens above the composer and stays inside the viewport', () => {
    const picker = read('human-chat-panel-emoji-picker.tsx');
    expect(picker).toContain("side = 'top'");
    expect(picker).toContain('collisionPadding={12}');
    expect(picker).toContain(
      'w-[min(22rem,var(--radix-popover-content-available-width),calc(100vw-2rem))]',
    );
    expect(picker).toContain('overflow-x-hidden');
    // Viewport collision only — a panel/sidebar collisionBoundary loops
    // Floating UI and crashes the message row when opening react emoji.
    expect(picker).not.toContain('collisionBoundary');
  });

  it('closes only the picker on Escape and lets the wheel scroll the grid', () => {
    const picker = read('human-chat-panel-emoji-picker.tsx');
    expect(picker).toContain('onEscapeKeyDown');
    expect(picker).toContain('event.stopPropagation()');
    expect(picker).toContain('event.isComposing || event.keyCode === 229');
    expect(picker).toContain("addEventListener('keydown', onKeyDown, true)");
    expect(picker).toContain('onWheel');
    const overflow = read('human-chat-panel-message-overflow.tsx');
    expect(overflow).toContain('onWheel={(event) => event.stopPropagation()}');
    expect(overflow).toContain('onEscapeKeyDown={(event) => {');
    expect(overflow).toContain('event.stopPropagation()');
    // Reaction-picker Escape must stopPropagation only — not preventDefault —
    // so the parent overflow menu can still close. Scope to that handler body.
    const reactionEscape = overflow.match(
      /onEscapeKeyDown=\{\(event\) => \{[^}]*\}/,
    )?.[0];
    expect(reactionEscape).toBeTruthy();
    expect(reactionEscape).toContain('event.stopPropagation()');
    expect(reactionEscape).not.toContain('event.preventDefault()');
    const chatBar = read('human-chat-panel-chat-bar.tsx');
    expect(chatBar).toContain(
      "e.key === 'Escape' && closeComposerOverlayFromEscape(e)",
    );
    expect(chatBar).toContain('e.stopPropagation()');
    const sidebar = readFileSync(
      resolve(dir, '../../../../ui/src/sidebar.tsx'),
      'utf8',
    );
    expect(sidebar).toContain('onEscapeKeyDown');
    expect(sidebar).toContain('shouldPreventEscapeDismiss');
    expect(sidebar).toContain('event.preventDefault()');
  });

  it('forces the emoji-mart host to the panel width, including the React wrapper', () => {
    const surface = read('human-chat-panel-emoji-mart-surface.tsx');
    expect(surface).toContain('w-full min-w-0');
    expect(surface).toContain('h-[min(22.5rem,calc(100dvh-8rem))]');
    expect(surface).toContain('[&>div]:w-full');
    expect(surface).toContain('[&_em-emoji-picker]:!w-full');
    expect(surface).toContain('data-hypha-emoji-picker');
    expect(surface).toContain('onWheel');
    expect(surface).not.toContain('onPointerDown');
    expect(surface).toContain('onTouchStart');
    expect(surface).toContain('pointer-events-auto');
    expect(surface).toContain('touch-manipulation');
    expect(surface).toContain('onKeyDown');
    expect(surface).toContain("if (event.key === 'Escape') return;");
    expect(surface).toContain('event.stopPropagation()');
    const picker = read('human-chat-panel-emoji-picker.tsx');
    // Portal to document.body — do not set `container` to the transform-animated
    // sidebar (Floating UI update loops wiped the chat panel).
    expect(picker).not.toContain('container={');
    expect(picker).toContain('z-[100]');
    expect(picker).toContain('onPointerDownOutside');
    expect(picker).toContain('onInteractOutside');
    expect(picker).not.toContain(
      'onPointerDown={(event) => event.stopPropagation()}',
    );
    const sidebar = readFileSync(
      resolve(dir, '../../../../ui/src/sidebar.tsx'),
      'utf8',
    );
    expect(sidebar).toContain('isEmojiMartEvent');
    expect(sidebar).toContain('onPointerDownOutside');
    expect(sidebar).toContain('onInteractOutside');
    expect(surface).not.toContain('min-w-[280px]');
    expect(surface).not.toContain('--em-emoji-picker-width');
  });
});
