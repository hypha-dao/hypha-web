import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCALES = ['de', 'en', 'es', 'fr', 'mk', 'nl', 'no', 'pt'] as const;

const consent = (locale: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../i18n/src/messages/${locale}.json`, import.meta.url),
      'utf8',
    ),
  ).AuthServer.consent as {
    client: Record<string, string>;
    spaces: Record<string, string>;
  };

describe('consent text for an app on the person’s computer and for kept spaces', () => {
  it('English names a local app plainly, with no address or port', () => {
    const { client, spaces } = consent('en');
    expect(client.localRedirect).toBe(
      'an app on this computer (a local connection)',
    );
    expect(spaces.unavailableKept).toMatch(/stay as they are/);
  });

  it('every locale has both texts of its own, with no placeholder and no number', () => {
    const english = consent('en');
    for (const locale of LOCALES) {
      const { client, spaces } = consent(locale);
      for (const text of [client.localRedirect, spaces.unavailableKept]) {
        expect(typeof text).toBe('string');
        expect(text!.length).toBeGreaterThan(10);
        expect(text).not.toMatch(/[{}]|\d/);
      }
      if (locale !== 'en') {
        expect(client.localRedirect).not.toBe(english.client.localRedirect);
        expect(spaces.unavailableKept).not.toBe(english.spaces.unavailableKept);
      }
    }
  });
});
