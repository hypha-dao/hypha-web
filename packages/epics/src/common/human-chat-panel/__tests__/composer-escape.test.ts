import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { composerOverlayConsumesEscape } from '../composer-escape';

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
  it('ChatBar registers a document capture listener and stops the Sheet', () => {
    const source = readFileSync(
      join(here, '../human-chat-panel-chat-bar.tsx'),
      'utf8',
    );
    expect(source).toContain("addEventListener('keydown', onKeyDown, true)");
    expect(source).toContain('stopImmediatePropagation');
    expect(source).toContain('closeComposerOverlayFromEscape');
  });

  it('emoji picker onEscapeKeyDown closes only the popover', () => {
    const source = readFileSync(
      join(here, '../human-chat-panel-emoji-picker.tsx'),
      'utf8',
    );
    expect(source).toContain('onEscapeKeyDown');
    expect(source).toContain('onOpenChange(false)');
  });
});
