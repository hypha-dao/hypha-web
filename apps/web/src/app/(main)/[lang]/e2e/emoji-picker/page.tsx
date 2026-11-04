import { notFound } from 'next/navigation';

import { E2eEmojiPickerHarness } from './e2e-emoji-picker-harness';

/**
 * Dev / Playwright harness for emoji-mart width and Sheet Escape checks.
 * Hidden in real production. Playwright's `nx start web` sets
 * `HYPHA_E2E_HARNESS=1` so `next start` can still reach this page.
 */
export default function E2eEmojiPickerPage() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.HYPHA_E2E_HARNESS !== '1'
  ) {
    notFound();
  }

  return <E2eEmojiPickerHarness />;
}
