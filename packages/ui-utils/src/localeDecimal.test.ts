import {
  parseLocaleDecimal,
  formatLocaleDecimal,
  getLocaleNumberSeparators,
} from './localeDecimal';

describe('getLocaleNumberSeparators', () => {
  it('uses . decimal and , group for en-US', () => {
    const { decimal, group } = getLocaleNumberSeparators('en-US');
    expect(decimal).toBe('.');
    expect(group).toBe(',');
  });

  it('uses , decimal and . group for de-DE', () => {
    const { decimal, group } = getLocaleNumberSeparators('de-DE');
    expect(decimal).toBe(',');
    expect(group).toBe('.');
  });
});

describe('parseLocaleDecimal', () => {
  it('parses en-US style', () => {
    expect(parseLocaleDecimal('1,234.56', 'en-US')).toBe(1234.56);
    expect(parseLocaleDecimal('0.9', 'en-US')).toBe(0.9);
  });

  it('parses de-DE style', () => {
    expect(parseLocaleDecimal('1.234,56', 'de-DE')).toBe(1234.56);
    expect(parseLocaleDecimal('0,9', 'de-DE')).toBe(0.9);
  });

  it('returns undefined for empty or invalid', () => {
    expect(parseLocaleDecimal('', 'en-US')).toBeUndefined();
    expect(parseLocaleDecimal('  ', 'en-US')).toBeUndefined();
    expect(parseLocaleDecimal('1.2.3', 'en-US')).toBeUndefined();
  });
});

describe('parseLocaleDecimal integers with grouping', () => {
  it('parses grouped integers', () => {
    expect(parseLocaleDecimal('1,234', 'en-US')).toBe(1234);
    expect(parseLocaleDecimal('1.234', 'de-DE')).toBe(1234);
  });
});

describe('formatLocaleDecimal', () => {
  it('formats with locale separators', () => {
    const de = formatLocaleDecimal(1234.56, 'de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    expect(de).toContain('234');
    expect(de).toContain('56');

    const en = formatLocaleDecimal(1234.56, 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    expect(en).toMatch(/1,234\.56/);
  });

  it('returns empty for non-finite', () => {
    expect(formatLocaleDecimal(undefined, 'en-US')).toBe('');
    expect(formatLocaleDecimal(NaN, 'en-US')).toBe('');
  });
});
