import { describe, it, expect } from 'vitest';
import {
  percentageStringToBigInt,
  bigIntToPercentageString,
} from '../percentage';

describe('percentageStringToBigInt', () => {
  it('converts "0.00" to 0n', () => {
    expect(percentageStringToBigInt('0.00')).toBe(0n);
  });

  it('converts "100.00" to 10000n', () => {
    expect(percentageStringToBigInt('100.00')).toBe(10000n);
  });

  it('converts "50.00" to 5000n', () => {
    expect(percentageStringToBigInt('50.00')).toBe(5000n);
  });

  it('converts "12.34" to 1234n', () => {
    expect(percentageStringToBigInt('12.34')).toBe(1234n);
  });

  it('converts "33.33" to 3333n', () => {
    expect(percentageStringToBigInt('33.33')).toBe(3333n);
  });

  it('converts "5" to 500n', () => {
    expect(percentageStringToBigInt('5')).toBe(500n);
  });

  it('converts "5.1" to 510n', () => {
    expect(percentageStringToBigInt('5.1')).toBe(510n);
  });

  it('converts "5.01" to 501n', () => {
    expect(percentageStringToBigInt('5.01')).toBe(501n);
  });

  it('converts "0.01" to 1n', () => {
    expect(percentageStringToBigInt('0.01')).toBe(1n);
  });

  it('converts "99.99" to 9999n', () => {
    expect(percentageStringToBigInt('99.99')).toBe(9999n);
  });

  it('throws on negative numbers', () => {
    expect(() => percentageStringToBigInt('-1.00')).toThrow();
  });

  it('throws on numbers greater than 100', () => {
    expect(() => percentageStringToBigInt('100.01')).toThrow();
    expect(() => percentageStringToBigInt('101')).toThrow();
  });

  it('throws on invalid format', () => {
    expect(() => percentageStringToBigInt('abc')).toThrow();
    expect(() => percentageStringToBigInt('12.345')).toThrow(); // three decimal places
    expect(() => percentageStringToBigInt('12.')).toThrow();
    expect(() => percentageStringToBigInt('.5')).toThrow();
  });

  it('handles whitespace', () => {
    expect(percentageStringToBigInt('  12.34  ')).toBe(1234n);
  });
});

describe('bigIntToPercentageString', () => {
  it('converts 0n to "0.00"', () => {
    expect(bigIntToPercentageString(0n)).toBe('0.00');
  });

  it('converts 10000n to "100.00"', () => {
    expect(bigIntToPercentageString(10000n)).toBe('100.00');
  });

  it('converts 5000n to "50.00"', () => {
    expect(bigIntToPercentageString(5000n)).toBe('50.00');
  });

  it('converts 1234n to "12.34"', () => {
    expect(bigIntToPercentageString(1234n)).toBe('12.34');
  });

  it('converts 500n to "5.00"', () => {
    expect(bigIntToPercentageString(500n)).toBe('5.00');
  });

  it('converts 510n to "5.10"', () => {
    expect(bigIntToPercentageString(510n)).toBe('5.10');
  });

  it('converts 1n to "0.01"', () => {
    expect(bigIntToPercentageString(1n)).toBe('0.01');
  });

  it('converts 9999n to "99.99"', () => {
    expect(bigIntToPercentageString(9999n)).toBe('99.99');
  });

  it('throws on non-bigint? (type safety)', () => {
    // TypeScript will prevent non-bigint, but runtime could pass number
    // We rely on Number conversion, which works for numbers but may produce NaN
    expect(() => bigIntToPercentageString(123 as any)).not.toThrow();
  });
});
