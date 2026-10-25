import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  COMPOSER_OVERLAY_ESCAPE_SELECTOR,
  composerOverlayConsumesEscape,
  shouldPreventChatSheetEscapeDismiss,
} from '../composer-escape';

const here = dirname(fileURLToPath(import.meta.url));

describe('composerOverlayConsumesEscape', () => {
  it('is true for the emoji picker or colon autocomplete', () => {
    expect(
      composerOverlayConsumesEscape({
        emojiPickerOpen: true,
        colonAutocompleteOpen: false,
      }),
    ).toBe(true);
    expect(
      composerOverlayConsumesEscape({
        emojiPickerOpen: false,
        colonAutocompleteOpen: true,
      }),
    ).toBe(true);
  });

  it('is false when no composer overlay is open', () => {
    expect(
      composerOverlayConsumesEscape({
        emojiPickerOpen: false,
        colonAutocompleteOpen: false,
      }),
    ).toBe(false);
  });
});

describe('composer Escape stays inside overlays', () => {
  it('ChatBar listens on window capture so it runs before the Sheet', () => {
    const source = readFileSync(
      join(here, '../human-chat-panel-chat-bar.tsx'),
      'utf8',
    );
    expect(source).toContain(
      "window.addEventListener('keydown', onKeyDown, true)",
    );
    expect(source).toContain('event.isComposing');
    expect(source).toContain('stopImmediatePropagation');
    expect(source).toContain('data-hypha-colon-autocomplete');
    const capture = source.slice(
      source.indexOf('handleComposerShellKeyDownCapture'),
    );
    const composingIdx = capture.indexOf('isComposing');
    const closeIdx = capture.indexOf('closeComposerOverlayFromEscape(e)');
    expect(composingIdx).toBeGreaterThanOrEqual(0);
    expect(closeIdx).toBeGreaterThanOrEqual(0);
    expect(composingIdx).toBeLessThan(closeIdx);
  });

  it('emoji picker uses window capture and onEscapeKeyDown', () => {
    const source = readFileSync(
      join(here, '../human-chat-panel-emoji-picker.tsx'),
      'utf8',
    );
    expect(source).toContain(
      "window.addEventListener('keydown', onKeyDown, true)",
    );
    expect(source).toContain('onEscapeKeyDown');
  });

  it('Sheet preventDefaults Escape via a caller-supplied shouldPreventEscapeDismiss', () => {
    const sidebar = readFileSync(
      join(here, '../../../../../ui/src/sidebar.tsx'),
      'utf8',
    );
    const wrapLayout = readFileSync(
      join(here, '../../panel-wrap-layout.tsx'),
      'utf8',
    );
    const surface = readFileSync(
      join(here, '../human-chat-panel-emoji-mart-surface.tsx'),
      'utf8',
    );
    expect(sidebar).toContain('shouldPreventEscapeDismiss');
    expect(sidebar).not.toContain(COMPOSER_OVERLAY_ESCAPE_SELECTOR);
    expect(wrapLayout).toContain(
      'shouldPreventEscapeDismiss={shouldPreventChatSheetEscapeDismiss}',
    );
    expect(surface).toContain('data-hypha-emoji-picker');
    expect(shouldPreventChatSheetEscapeDismiss()).toBe(false);
  });
});
