import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { signalDetailPath } from '../signal-detail-path';

const pageSource = readFileSync(
  resolve(__dirname, '../../components/signal-page.tsx'),
  'utf8',
);
const editPage = readFileSync(
  resolve(
    __dirname,
    '../../../../../../apps/web/src/app/(main)/[lang]/dho/[id]/@aside/[tab]/edit-signal/[signalSlug]/page.tsx',
  ),
  'utf8',
);

describe('signalDetailPath', () => {
  it('opens that signal', () => {
    expect(signalDetailPath('en', 'noord', 'budget-q2')).toBe(
      '/en/dho/noord/coherence/signal/budget-q2',
    );
    expect(signalDetailPath('pt', 'hypha', 'a&b/c')).toBe(
      '/pt/dho/hypha/coherence/signal/a%26b%2Fc',
    );
  });

  it('is where a saved edit returns', () => {
    expect(editPage).toContain('signalDetailPath(lang, id, signal.slug)');
    expect(editPage).toContain('successfulUrl={detailUrl}');
    expect(editPage).toContain('closeUrl={listUrl}');
  });
});

describe('signal detail chat', () => {
  it('opens from the discussion control and does not auto-open', () => {
    expect(pageSource).toContain('onClick={openChat}');
    expect(pageSource).not.toContain('autoOpenedForRef');
    expect(pageSource).not.toContain('openChat();');
  });
});
