import { afterEach, describe, expect, it } from 'vitest';
import {
  parseIso8601DurationToMs,
  resolveMaxEventAgeMs,
  resolveReconcileWindowMs,
} from '../duration';

describe('parseIso8601DurationToMs', () => {
  it('parses hour / day / minute / second forms', () => {
    expect(parseIso8601DurationToMs('PT6H')).toBe(6 * 3600_000);
    expect(parseIso8601DurationToMs('P1D')).toBe(24 * 3600_000);
    expect(parseIso8601DurationToMs('PT90M')).toBe(90 * 60_000);
    expect(parseIso8601DurationToMs('PT30S')).toBe(30_000);
    expect(parseIso8601DurationToMs('P1DT12H')).toBe(36 * 3600_000);
  });

  it('is case-insensitive and trims', () => {
    expect(parseIso8601DurationToMs('  pt6h ')).toBe(6 * 3600_000);
  });

  it('rejects empty / malformed / unsupported components', () => {
    for (const bad of ['', 'P', 'PT', '6H', 'P1W', 'P1Y', 'PT0H', 'nonsense']) {
      expect(parseIso8601DurationToMs(bad)).toBeNull();
    }
  });
});

describe('resolveReconcileWindowMs', () => {
  const ORIGINAL = process.env.NOTIFICATION_RECONCILE_WINDOW;
  afterEach(() => {
    if (ORIGINAL === undefined)
      delete process.env.NOTIFICATION_RECONCILE_WINDOW;
    else process.env.NOTIFICATION_RECONCILE_WINDOW = ORIGINAL;
  });

  it('defaults to 6h when unset', () => {
    delete process.env.NOTIFICATION_RECONCILE_WINDOW;
    expect(resolveReconcileWindowMs()).toBe(6 * 3600_000);
  });

  it('uses a valid env value', () => {
    process.env.NOTIFICATION_RECONCILE_WINDOW = 'PT2H';
    expect(resolveReconcileWindowMs()).toBe(2 * 3600_000);
  });

  it('falls back to 6h on an invalid env value', () => {
    process.env.NOTIFICATION_RECONCILE_WINDOW = 'garbage';
    expect(resolveReconcileWindowMs()).toBe(6 * 3600_000);
  });
});

describe('resolveMaxEventAgeMs', () => {
  const original = process.env.NOTIFICATION_MAX_EVENT_AGE;
  afterEach(() => {
    if (original === undefined) delete process.env.NOTIFICATION_MAX_EVENT_AGE;
    else process.env.NOTIFICATION_MAX_EVENT_AGE = original;
  });

  it('defaults to 24h', () => {
    delete process.env.NOTIFICATION_MAX_EVENT_AGE;
    expect(resolveMaxEventAgeMs()).toBe(24 * 60 * 60 * 1000);
  });

  it('reads an ISO-8601 duration from the env', () => {
    process.env.NOTIFICATION_MAX_EVENT_AGE = 'PT2H';
    expect(resolveMaxEventAgeMs()).toBe(2 * 60 * 60 * 1000);
  });

  it('falls back to the default on an invalid value', () => {
    process.env.NOTIFICATION_MAX_EVENT_AGE = 'soon';
    expect(resolveMaxEventAgeMs()).toBe(24 * 60 * 60 * 1000);
  });
});
