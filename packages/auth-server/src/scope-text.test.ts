import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCALES = ['de', 'en', 'es', 'fr', 'mk', 'nl', 'no', 'pt'] as const;

const read = (locale: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../i18n/src/messages/${locale}.json`, import.meta.url),
      'utf8',
    ),
  ).AuthServer.consent.scopes.spacesRead as { title: string; detail: string };

describe('consent text of spaces:read', () => {
  it('English says what release 1 gives: the spaces the person allows, read-only, shared with the AI provider', () => {
    const { detail } = read('en');
    expect(detail).toMatch(/read-only/i);
    expect(detail).toMatch(/spaces you allow/i);
    for (const word of ['membership', 'proposals', 'votes'])
      expect(detail).toContain(word);
    expect(detail).toMatch(/provider of the AI app/i);
    expect(detail).toMatch(/cannot change anything/i);
    // The old, understated wording is gone.
    expect(detail).not.toMatch(/public activity/i);
  });

  it('keeps the signal and quest distinction out of the consent text', () => {
    const { detail } = read('en');
    expect(detail).not.toMatch(/commit/i);
  });

  it('every locale carries a full text of its own (no empty value, no leftover English, no old text)', () => {
    const english = read('en').detail;
    for (const locale of LOCALES) {
      const { title, detail } = read(locale);
      expect(title.length).toBeGreaterThan(0);
      expect(detail.length).toBeGreaterThan(80);
      if (locale !== 'en') expect(detail).not.toBe(english);
      expect(detail).not.toMatch(/public activity|öffentliche Aktivität/i);
    }
  });
});
