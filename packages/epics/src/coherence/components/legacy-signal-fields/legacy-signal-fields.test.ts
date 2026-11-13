import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacySignalFieldsToShow } from './legacy-signal-fields';

const here = dirname(fileURLToPath(import.meta.url));

describe('legacy signal fields', () => {
  it('treats the stored defaults as empty', () => {
    expect(
      legacySignalFieldsToShow({
        sharedWithNetwork: false,
        capitals: [],
        priority: 'medium',
        tags: [],
        dueAt: null,
        indicativePayouts: [],
      }),
    ).toBeNull();
    expect(
      legacySignalFieldsToShow({
        indicativePayouts: [{ amount: '', token: '' }],
      }),
    ).toBeNull();
  });

  it('keeps only the fields that were actually set', () => {
    const shown = legacySignalFieldsToShow({
      sharedWithNetwork: true,
      capitals: ['financial', 'not-a-capital'],
      priority: 'high',
      tags: [' Needs ', ''],
      dueAt: '2026-12-01T12:00:00.000Z',
      indicativePayouts: [
        { amount: '2', token: '0xabc' },
        { amount: '', token: '0xdef' },
      ],
    });
    expect(shown).toMatchObject({
      sharedWithNetwork: true,
      capitals: ['financial'],
      priority: 'high',
      tags: ['Needs'],
      indicativePayouts: [{ amount: '2', token: '0xabc' }],
    });
    expect(shown?.dueAt).toBeInstanceOf(Date);
  });

  it('is one absolute insertion in the form and one nullable insertion on the page', () => {
    const form = readFileSync(join(here, '../create-signal-form.tsx'), 'utf8');
    const page = readFileSync(join(here, '../signal-page.tsx'), 'utf8');
    const disclosure = readFileSync(
      join(here, 'legacy-signal-fields-form.tsx'),
      'utf8',
    );
    expect(form.match(/<LegacySignalFieldsDisclosure/g)).toHaveLength(1);
    expect(form).toContain(
      'relative flex w-full flex-col items-end gap-3 pt-8',
    );
    expect(form).toContain('flex w-full justify-end gap-2');
    expect(form.indexOf('<LegacySignalFieldsDisclosure')).toBeLessThan(
      form.indexOf('flex w-full justify-end gap-2'),
    );
    expect(page.match(/<LegacySignalFieldsDetail/g)).toHaveLength(1);
    expect(page.indexOf('<SignalMediaSection')).toBeLessThan(
      page.indexOf('<LegacySignalFieldsDetail'),
    );
    expect(disclosure).toContain('absolute right-0 top-2');
    expect(disclosure).toContain('className="w-full self-stretch"');
    expect(disclosure).not.toContain('absolute bottom-full');
    const toggle = disclosure.slice(
      disclosure.indexOf('data-testid="legacy-signal-fields-toggle"') - 80,
      disclosure.indexOf('</button>'),
    );
    expect(toggle).not.toContain('aria-label');
    expect(toggle).not.toContain('title=');
    expect(toggle).toContain('<ChevronDown');
  });
});
