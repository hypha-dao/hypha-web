import { describe, expect, it } from 'vitest';
import { resolveAuthLocale } from '../locale';

const supported = ['en', 'pt', 'es', 'fr', 'de', 'mk', 'nl', 'no'];
const base = { supported, fallback: 'en' };

describe('resolveAuthLocale', () => {
  it('?lang wins over the cookie and the browser, and says it came from the parameter', () => {
    expect(
      resolveAuthLocale({
        ...base,
        lang: 'de',
        cookie: 'fr',
        acceptLanguage: 'es',
      }),
    ).toEqual({ locale: 'de', fromParam: true });
  });

  it('the cookie wins over the browser', () => {
    expect(
      resolveAuthLocale({ ...base, cookie: 'fr', acceptLanguage: 'es' }),
    ).toEqual({ locale: 'fr', fromParam: false });
  });

  it('reads Accept-Language by weight, with region tags and Norwegian aliases', () => {
    expect(
      resolveAuthLocale({
        ...base,
        acceptLanguage: 'ja;q=0.9, pt-BR;q=0.8, en;q=0.5',
      }),
    ).toEqual({ locale: 'pt', fromParam: false });
    expect(
      resolveAuthLocale({ ...base, acceptLanguage: 'nb-NO,nb;q=0.9' }).locale,
    ).toBe('no');
    expect(
      resolveAuthLocale({ ...base, acceptLanguage: 'fr;q=0, es;q=0.1' }).locale,
    ).toBe('es');
  });

  it('ignores unsupported or malformed values and falls back', () => {
    expect(
      resolveAuthLocale({
        ...base,
        lang: 'zz',
        cookie: '../x',
        acceptLanguage: 'ja, *;q=0.1',
      }),
    ).toEqual({ locale: 'en', fromParam: false });
    expect(resolveAuthLocale({ ...base }).locale).toBe('en');
    expect(resolveAuthLocale({ ...base, lang: '<script>' }).locale).toBe('en');
  });
});
