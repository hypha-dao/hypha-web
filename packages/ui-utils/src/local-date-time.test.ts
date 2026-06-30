import { describe, expect, it } from 'vitest';
import {
  formatLocalDateTime,
  isValidTimeZone,
  parseDateInput,
} from './local-date-time';

describe('local-date-time', () => {
  it('validates IANA timezones', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Invalid/Zone')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });

  it('parses date inputs', () => {
    expect(parseDateInput('2024-06-15T12:00:00.000Z')?.toISOString()).toBe(
      '2024-06-15T12:00:00.000Z',
    );
    expect(parseDateInput('not-a-date')).toBeNull();
  });

  it('formats with an explicit timezone', () => {
    const formatted = formatLocalDateTime('2024-06-15T12:00:00.000Z', {
      locale: 'en-US',
      timeZone: 'America/New_York',
      withTime: true,
    });

    expect(formatted).toContain('2024');
    expect(formatted).toMatch(/8:00:00 AM|08:00:00/);
  });
});
