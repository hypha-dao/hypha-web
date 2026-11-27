import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacySignalFieldsToShow } from '../legacy-signal-fields';

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

  it('is not rendered in the form or on the signal page (#2763 D5)', () => {
    const form = readFileSync(
      join(here, '../../create-signal-form.tsx'),
      'utf8',
    );
    const page = readFileSync(join(here, '../../signal-page.tsx'), 'utf8');
    expect(form).not.toContain('<LegacySignalFieldsDisclosure');
    expect(form).not.toContain('legacy-signal-fields');
    expect(page).not.toContain('<LegacySignalFieldsDetail');
    expect(page).not.toContain('legacy-signal-fields');
  });

  it('leaves tags and board to the first-class fields after the type picker', () => {
    const form = readFileSync(
      join(here, '../../create-signal-form.tsx'),
      'utf8',
    );
    const disclosure = readFileSync(
      join(here, '../legacy-signal-fields-form.tsx'),
      'utf8',
    );
    expect(disclosure).not.toContain('name="tags"');
    expect(disclosure).not.toContain('name="board"');
    const typeSectionEnd = form.indexOf('</SignalTypeSection>');
    expect(typeSectionEnd).toBeGreaterThan(-1);
    expect(form.indexOf('<SignalTagsField')).toBeGreaterThan(typeSectionEnd);
    expect(form.indexOf('<SignalBoardField')).toBeGreaterThan(
      form.indexOf('<SignalTagsField'),
    );
  });
});
