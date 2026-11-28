import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCALES = ['de', 'en', 'es', 'fr', 'mk', 'nl', 'no', 'pt'] as const;

const apps = (locale: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../i18n/src/messages/${locale}.json`, import.meta.url),
      'utf8',
    ),
  ).AuthServer.apps as Record<string, unknown>;

/** Every key path of a nested message object, with its placeholders. */
const shape = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [
          `${prefix}${key}:${[...value.matchAll(/\{(\w+)\}/g)]
            .map((m) => m[1])
            .sort()
            .join(',')}`,
        ]
      : shape(value as Record<string, unknown>, `${prefix}${key}.`),
  );

describe('connected-apps page texts', () => {
  it('every locale has the same keys and placeholders as English, each with its own words', () => {
    const english = apps('en');
    const expected = shape(english).sort();
    for (const locale of LOCALES) {
      const texts = apps(locale);
      expect(shape(texts).sort()).toEqual(expected);
      if (locale !== 'en') expect(texts.intro).not.toBe(english.intro);
    }
  });

  it('English says how long access lasts after a disconnect, and never shows an id', () => {
    const english = apps('en');
    expect(english.confirmDisconnect).toMatch(/within 10 minutes/);
    expect(JSON.stringify(english)).not.toMatch(/client.?id/i);
  });
});
