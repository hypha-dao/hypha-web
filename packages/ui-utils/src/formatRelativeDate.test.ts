import {
  formatRelativeDate,
  formatRelativeDateShort,
} from './formatRelativeDate';

describe('formatRelativeDate', () => {
  beforeAll(() => {
    // Mock the current date for consistent tests
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-25T09:36:40.928Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('formats seconds correctly', () => {
    const date = new Date('2026-02-25T09:36:30.928Z'); // 10 seconds ago
    expect(formatRelativeDate(date)).toBe('10 seconds ago');
  });

  test('formats minutes correctly', () => {
    const date = new Date('2026-02-25T09:26:40.928Z'); // 10 minutes ago
    expect(formatRelativeDate(date)).toBe('10 minutes ago');
  });

  test('formats hours correctly', () => {
    const date = new Date('2026-02-25T01:36:40.928Z'); // 8 hours ago
    expect(formatRelativeDate(date)).toBe('8 hours ago');
  });

  test('formats days correctly', () => {
    const date = new Date('2026-02-20T09:36:40.928Z'); // 5 days ago
    expect(formatRelativeDate(date)).toBe('5 days ago');
  });

  test('formats months correctly', () => {
    const date = new Date('2025-12-25T09:36:40.928Z'); // 2 months ago
    expect(formatRelativeDate(date)).toBe('2 months ago');
  });

  test('formats years correctly', () => {
    const date = new Date('2020-02-25T09:36:40.928Z'); // 6 years ago
    expect(formatRelativeDate(date)).toBe('6 years ago');
  });

  test('formats singular units correctly', () => {
    const date = new Date('2026-02-25T09:35:40.928Z'); // 1 minute ago
    expect(formatRelativeDate(date)).toBe('1 minute ago');
  });

  test('formats with custom prefix and suffix', () => {
    const date = new Date('2026-02-25T09:26:40.928Z'); // 10 minutes ago
    expect(formatRelativeDate(date, { prefix: 'Posted', suffix: 'ago' })).toBe(
      'Posted 10 minutes ago',
    );
    expect(formatRelativeDate(date, { prefix: 'Posted', suffix: '' })).toBe(
      'Posted 10 minutes',
    );
    expect(formatRelativeDate(date, { prefix: '', suffix: 'ago' })).toBe(
      '10 minutes ago',
    );
  });

  test('formats with short units', () => {
    const date = new Date('2026-02-25T09:26:40.928Z'); // 10 minutes ago
    expect(formatRelativeDateShort(date)).toBe('10m ago');

    const date2 = new Date('2026-02-25T01:36:40.928Z'); // 8 hours ago
    expect(formatRelativeDateShort(date2)).toBe('8h ago');
  });

  test('throws error for invalid date', () => {
    expect(() => formatRelativeDate('invalid-date')).toThrow(
      'Invalid date input',
    );
  });

  test('formats with German language', () => {
    const date = new Date('2026-02-25T09:26:40.928Z'); // 10 minutes ago
    expect(formatRelativeDate(date, { language: 'de' })).toBe('10 Minuten ago');
  });
});
