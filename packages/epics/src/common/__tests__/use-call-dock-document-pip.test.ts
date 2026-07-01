// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { copyCallDocumentPipAppearance } from '../use-call-dock-document-pip';

describe('copyCallDocumentPipAppearance', () => {
  it('copies space accent CSS variables into the PiP document (WCUX-PIP-3)', () => {
    document.documentElement.style.setProperty('--space-accent', '#336699');
    document.documentElement.style.setProperty('--foreground', '#111111');

    const target = document.implementation.createHTMLDocument('pip');
    copyCallDocumentPipAppearance(document, target);

    expect(
      target.documentElement.style.getPropertyValue('--space-accent').trim(),
    ).toBe('#336699');
    expect(
      target.documentElement.style.getPropertyValue('--foreground').trim(),
    ).toBe('#111111');
  });
});
