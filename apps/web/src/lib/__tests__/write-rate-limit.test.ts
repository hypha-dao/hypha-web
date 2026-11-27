import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// Only the limiter pieces of core are needed; the real ones, without the whole server barrel.
vi.mock(
  '@hypha-platform/core/server',
  () => import('../../../../../packages/core/src/features/write-guards'),
);

import {
  createFirewallWriteRateLimiter,
  signalCreateWindows,
  type FirewallCheck,
  type FirewallWindow,
} from '../write-rate-limit';

const KEY = 'signals.create:7';
const MINUTE = { limit: 2, windowMs: 60_000 };
const HOUR = { limit: 3, windowMs: 3_600_000 };
const windows = (
  ...rules: [minuteRule: string | undefined, hourRule: string | undefined] | []
): FirewallWindow[] => {
  const [minuteRule, hourRule] =
    rules.length === 0 ? ['rule-minute', 'rule-hour'] : rules;
  return windowsOf(minuteRule, hourRule);
};
const windowsOf = (
  minuteRule: string | undefined,
  hourRule: string | undefined,
): FirewallWindow[] => [
  { name: 'signals-create-minute', ruleId: minuteRule, window: MINUTE },
  { name: 'signals-create-hour', ruleId: hourRule, window: HOUR },
];

const check = vi.fn<Parameters<FirewallCheck>, ReturnType<FirewallCheck>>();
const log = vi.fn();
const request = new Headers({
  host: 'app.example',
  'x-real-ip': '203.0.113.7',
  'x-forwarded-for': '203.0.113.7',
  authorization: 'Bearer secret-token',
  cookie: 'session=abc',
});
const deps = (over: Record<string, unknown> = {}) => ({
  check,
  requestHeaders: async () => request,
  production: true,
  log,
  now: () => 1_000_000,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  check.mockResolvedValue({ rateLimited: false });
});

describe('createFirewallWriteRateLimiter', () => {
  it('ok from every rule: the write is taken, each rule asked once with the person key', async () => {
    const limiter = createFirewallWriteRateLimiter(windows(), deps());
    expect(await limiter.take(KEY)).toEqual({ ok: true });
    expect(check).toHaveBeenCalledTimes(2);
    expect(check.mock.calls.map((c) => c[0])).toEqual([
      'rule-minute',
      'rule-hour',
    ]);
    expect(check.mock.calls[0]![1]).toMatchObject({
      rateLimitKey: KEY,
      timeout: 1500,
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('passes only host and the client address headers, never credentials', async () => {
    const limiter = createFirewallWriteRateLimiter(windows(), deps());
    await limiter.take(KEY);
    const sent = check.mock.calls[0]![1].headers;
    expect([...sent.keys()].sort()).toEqual([
      'host',
      'x-forwarded-for',
      'x-real-ip',
    ]);
  });

  it('limited: refused with the window length as retry time, later rules not asked', async () => {
    check.mockResolvedValueOnce({ rateLimited: true });
    const limiter = createFirewallWriteRateLimiter(windows(), deps());
    expect(await limiter.take(KEY)).toEqual({
      ok: false,
      retryAfterSeconds: 60,
    });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('an hour refusal reports the hour', async () => {
    check
      .mockResolvedValueOnce({ rateLimited: false })
      .mockResolvedValueOnce({ rateLimited: true });
    const limiter = createFirewallWriteRateLimiter(windows(), deps());
    expect(await limiter.take(KEY)).toEqual({
      ok: false,
      retryAfterSeconds: 3600,
    });
  });

  it('blocked counts as limited', async () => {
    check.mockResolvedValueOnce({ rateLimited: true, error: 'blocked' });
    const limiter = createFirewallWriteRateLimiter(windows(), deps());
    expect(await limiter.take(KEY)).toMatchObject({ ok: false });
  });

  const fallbackCases: [string, () => void, Record<string, unknown>][] = [
    [
      'not-found',
      () => {
        check.mockResolvedValue({ rateLimited: false, error: 'not-found' });
      },
      {},
    ],
    [
      'an error',
      () => {
        check.mockRejectedValue(new Error('status 500'));
      },
      {},
    ],
    [
      'a timeout',
      () => {
        check.mockRejectedValue(
          Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
        );
      },
      {},
    ],
    [
      'unreadable request headers',
      () => undefined,
      { requestHeaders: async () => Promise.reject(new Error('no request')) },
    ],
  ];
  it.each(fallbackCases)(
    '%s: falls back to memory for that window, never all blocked, never unlimited',
    async (_label, arrange, over) => {
      arrange();
      const limiter = createFirewallWriteRateLimiter(windows(), deps(over));
      // The minute window in memory allows 2, then refuses.
      expect(await limiter.take(KEY)).toEqual({ ok: true });
      expect(await limiter.take(KEY)).toEqual({ ok: true });
      expect(await limiter.take(KEY)).toMatchObject({ ok: false });
      // Another person still has a budget.
      expect(await limiter.take('signals.create:8')).toEqual({ ok: true });
      expect(log).toHaveBeenCalledWith('[rate] fallback', {
        rule: 'signals-create-minute',
      });
      // The log line names the rule, never the key or the rule id.
      expect(JSON.stringify(log.mock.calls)).not.toContain('signals.create:');
      expect(JSON.stringify(log.mock.calls)).not.toContain('rule-minute');
    },
  );

  it('outside production: in memory only, the firewall is never asked', async () => {
    const limiter = createFirewallWriteRateLimiter(
      windows(),
      deps({ production: false }),
    );
    expect(await limiter.take(KEY)).toEqual({ ok: true });
    expect(await limiter.take(KEY)).toEqual({ ok: true });
    expect(await limiter.take(KEY)).toMatchObject({ ok: false });
    expect(check).not.toHaveBeenCalled();
  });

  it('no rule ids set (or blank): in memory only, like before', async () => {
    const limiter = createFirewallWriteRateLimiter(
      windows(undefined, '  '),
      deps(),
    );
    expect(await limiter.take(KEY)).toEqual({ ok: true });
    expect(await limiter.take(KEY)).toEqual({ ok: true });
    expect(await limiter.take(KEY)).toEqual({
      ok: false,
      retryAfterSeconds: 60,
    });
    expect(check).not.toHaveBeenCalled();
  });

  it('one rule set: that window asks the firewall, the other counts in memory', async () => {
    const limiter = createFirewallWriteRateLimiter(
      windows('rule-minute', undefined),
      deps(),
    );
    expect(await limiter.take(KEY)).toEqual({ ok: true });
    expect(await limiter.take(KEY)).toEqual({ ok: true });
    expect(await limiter.take(KEY)).toEqual({ ok: true });
    // The hour window in memory allows 3.
    expect(await limiter.take(KEY)).toEqual({
      ok: false,
      retryAfterSeconds: 3600,
    });
    expect(check.mock.calls.every((c) => c[0] === 'rule-minute')).toBe(true);
  });
});

describe('signalCreateWindows', () => {
  it('reads the two rule ids by name and keeps the shared limits', () => {
    const [minute, hour] = signalCreateWindows({
      WRITE_RATE_RULE_SIGNALS_CREATE_MINUTE: 'a',
      WRITE_RATE_RULE_SIGNALS_CREATE_HOUR: 'b',
    });
    expect(minute).toMatchObject({
      name: 'signals-create-minute',
      ruleId: 'a',
      window: { limit: 10, windowMs: 60_000 },
    });
    expect(hour).toMatchObject({
      name: 'signals-create-hour',
      ruleId: 'b',
      window: { limit: 100, windowMs: 3_600_000 },
    });
    expect(signalCreateWindows({})[0]!.ruleId).toBeUndefined();
  });
});
