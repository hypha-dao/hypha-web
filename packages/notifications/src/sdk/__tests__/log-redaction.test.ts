import { describe, expect, it } from 'vitest';
import { redactedLogString, redactForLog } from '../log-redaction';

describe('redactForLog', () => {
  it('keeps the shape of invalid_aliases but drops the aliases themselves', () => {
    const out = JSON.stringify(
      redactForLog({ invalid_aliases: { external_id: ['gerroza', 'gernz'] } }),
    );
    expect(out).toContain('invalid_aliases');
    expect(out).toContain('external_id');
    expect(out).toContain('[2 items]');
    expect(out).not.toContain('gerroza');
    expect(out).not.toContain('gernz');
  });

  it('keeps message strings under message keys, truncated', () => {
    const long = 'x'.repeat(500);
    const out = redactForLog({
      errors: ['Notification content must not be empty', long],
    }) as {
      errors: string[];
    };
    expect(out.errors[0]).toBe('Notification content must not be empty');
    expect(out.errors[1]).toHaveLength(201);
  });

  it('redacts strings under other keys and non-message arrays', () => {
    const out = JSON.stringify(
      redactForLog({ external_id: 'gerroza', ids: ['a', 'b', 'c'], count: 3 }),
    );
    expect(out).not.toContain('gerroza');
    expect(out).toContain('<redacted>');
    expect(out).toContain('[3 items]');
    expect(out).toContain('"count":3');
  });

  it('passes null and undefined through', () => {
    expect(redactForLog(null)).toBeNull();
    expect(redactForLog(undefined)).toBeUndefined();
  });
});

describe('redactedLogString', () => {
  it('parses a JSON string body before redacting it', () => {
    const body = JSON.stringify({
      errors: ['Invalid template'],
      invalid_aliases: { external_id: ['gerroza'] },
    });
    const out = redactedLogString(body) ?? '';
    expect(out).toContain('Invalid template');
    expect(out).not.toContain('gerroza');
  });

  it('truncates a plain (non-JSON) message string', () => {
    expect(redactedLogString('Bad Request')).toBe('Bad Request');
    expect(redactedLogString('y'.repeat(300))).toHaveLength(201);
  });

  it('returns undefined for missing values', () => {
    expect(redactedLogString(undefined)).toBeUndefined();
    expect(redactedLogString(null)).toBeUndefined();
  });
});
