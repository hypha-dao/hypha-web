// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  escapeCssSelector,
  findSignalCardElement,
  SIGNAL_SLUG_SELECTOR_ATTR,
} from '../signal-deep-link-dom';

describe('signal-deep-link-dom', () => {
  it('finds signal cards by slug attribute', () => {
    document.body.innerHTML = `
      <div ${SIGNAL_SLUG_SELECTOR_ATTR}="coh-a6d1d355">Signal A</div>
      <div ${SIGNAL_SLUG_SELECTOR_ATTR}="coh-other">Signal B</div>
    `;

    expect(findSignalCardElement('coh-a6d1d355')?.textContent).toBe('Signal A');
    expect(findSignalCardElement('missing')).toBeNull();
  });

  it('escapes special characters in slug selectors', () => {
    expect(escapeCssSelector('coh-"test"')).toContain('\\"');
  });
});
