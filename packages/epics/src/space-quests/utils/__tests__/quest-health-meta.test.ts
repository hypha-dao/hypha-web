import { describe, expect, it } from 'vitest';
import {
  formatRelativeTimeShort,
  healthBadgeMeta,
} from '../../quest-health-meta';

describe('quest health meta', () => {
  it('keeps the list and detail badge colors in one place', () => {
    expect(healthBadgeMeta('on_track').label).toBe('On track');
    expect(healthBadgeMeta('at_risk').dotClass).toContain('#d99a1e');
    expect(healthBadgeMeta('off_track').textClass).toContain('#d2463c');
  });

  it('formats short relative times', () => {
    expect(formatRelativeTimeShort(null)).toBe('just now');
    expect(formatRelativeTimeShort('not-a-date')).toBe('just now');
    expect(formatRelativeTimeShort(new Date().toISOString())).toBe('just now');
  });
});
