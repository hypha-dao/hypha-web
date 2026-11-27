import { describe, expect, it } from 'vitest';

import {
  SIGNAL_CREATE_LIMITS,
  contentFingerprint,
  createMemoryWriteRateLimiter,
  normaliseForDuplicate,
  signalCreateRateKey,
} from '../write-guards';

describe('createMemoryWriteRateLimiter', () => {
  const clock = () => {
    let t = 1_000_000;
    return { now: () => t, advance: (ms: number) => (t += ms) };
  };

  it('allows up to the per-minute limit, then says when to retry', () => {
    const c = clock();
    const limiter = createMemoryWriteRateLimiter(SIGNAL_CREATE_LIMITS, c.now);
    for (let i = 0; i < 10; i++) expect(limiter.take('k').ok).toBe(true);
    const refused = limiter.take('k');
    expect(refused).toEqual({ ok: false, retryAfterSeconds: 60 });
    c.advance(30_000);
    expect(limiter.take('k')).toEqual({ ok: false, retryAfterSeconds: 30 });
    c.advance(30_000);
    expect(limiter.take('k').ok).toBe(true);
  });

  it('the hourly limit holds across minutes', () => {
    const c = clock();
    const limiter = createMemoryWriteRateLimiter(SIGNAL_CREATE_LIMITS, c.now);
    let allowed = 0;
    for (let minute = 0; minute < 12; minute++) {
      for (let i = 0; i < 10; i++) if (limiter.take('k').ok) allowed++;
      c.advance(60_000);
    }
    expect(allowed).toBe(100);
    const refused = limiter.take('k');
    expect(refused.ok).toBe(false);
  });

  it('a refused write spends nothing in the other window', () => {
    const c = clock();
    const limiter = createMemoryWriteRateLimiter(
      [
        { limit: 1, windowMs: 60_000 },
        { limit: 2, windowMs: 3_600_000 },
      ],
      c.now,
    );
    expect(limiter.take('k').ok).toBe(true);
    expect(limiter.take('k').ok).toBe(false); // minute full; the hour must not count it
    c.advance(60_000);
    expect(limiter.take('k').ok).toBe(true);
  });

  it('keys are independent', () => {
    const limiter = createMemoryWriteRateLimiter([
      { limit: 1, windowMs: 60_000 },
    ]);
    expect(limiter.take(signalCreateRateKey(1)).ok).toBe(true);
    expect(limiter.take(signalCreateRateKey(2)).ok).toBe(true);
    expect(limiter.take(signalCreateRateKey(1)).ok).toBe(false);
  });
});

describe('duplicate fingerprint', () => {
  const base = {
    personId: 1,
    spaceId: 2,
    clientId: 'c',
    title: 'Water shortage',
    description: 'The well  is\n dry.',
  };

  it('ignores case, surrounding and repeated whitespace', () => {
    expect(normaliseForDuplicate('  The well  is\n dry. ')).toBe(
      'the well is dry.',
    );
    expect(
      contentFingerprint({
        ...base,
        title: ' water SHORTAGE ',
        description: 'the well is dry.',
      }),
    ).toBe(contentFingerprint(base));
  });

  it('differs per person, space, client and content', () => {
    const fp = contentFingerprint(base);
    expect(contentFingerprint({ ...base, personId: 9 })).not.toBe(fp);
    expect(contentFingerprint({ ...base, spaceId: 9 })).not.toBe(fp);
    expect(contentFingerprint({ ...base, clientId: 'other' })).not.toBe(fp);
    expect(contentFingerprint({ ...base, title: 'Other' })).not.toBe(fp);
    expect(contentFingerprint({ ...base, description: 'x' })).not.toBe(fp);
  });
});
