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
    expect(picker).toContain('w-[min(calc(100vw-2rem),22rem)]');
    expect(picker).toContain('overflow-hidden');
  });

  it('closes only the picker on Escape and lets the wheel scroll the grid', () => {
    const picker = read('human-chat-panel-emoji-picker.tsx');
    expect(picker).toContain('onEscapeKeyDown');
    expect(picker).toContain('event.stopPropagation()');
    expect(picker).toContain('onWheel');
    const overflow = read('human-chat-panel-message-overflow.tsx');
    expect(overflow).toContain('onWheel={(event) => event.stopPropagation()}');
    const chatBar = read('human-chat-panel-chat-bar.tsx');
    expect(chatBar).toContain("e.key === 'Escape' && emojiPickerOpen");
    expect(chatBar).toContain('e.stopPropagation()');
  });

  it('lets emoji-mart fill a definite-width parent instead of a second min-width', () => {
    const surface = read('human-chat-panel-emoji-mart-surface.tsx');
    expect(surface).toContain('w-full min-w-0');
    expect(surface).toContain('h-[min(22.5rem,calc(100dvh-8rem))]');
    expect(surface).toContain('--em-emoji-picker-width');
    expect(surface).toContain('onWheel');
    expect(surface).not.toContain('min-w-[280px]');
  });
});
