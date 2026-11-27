import 'server-only';
import {
  SIGNAL_CREATE_LIMITS,
  asWriteRateLimiter,
  createMemoryWriteRateLimiter,
  type RateDecision,
  type RateWindow,
  type WriteRateLimiter,
} from '@hypha-platform/core/server';

/**
 * Write rate limits backed by the platform firewall (#2745), one budget per person shared by the
 * app and every AI client. Each window is a firewall rule when its rule id is set and the app runs
 * in production; otherwise, and whenever the firewall cannot answer, that window is counted in
 * memory on this instance. It never blocks every write and never lets writes through unlimited.
 */

/** One window of a write budget. */
export type FirewallWindow = {
  /** A fixed name for logs. Never the rule id itself. */
  name: string;
  /** The firewall rule id; unset or empty keeps this window in memory. */
  ruleId: string | undefined;
  window: RateWindow;
};

/** The firewall check, shaped like `checkRateLimit` from `@vercel/firewall`. */
export type FirewallCheck = (
  ruleId: string,
  options: { rateLimitKey: string; headers: Headers; timeout: number },
) => Promise<{ rateLimited: boolean; error?: 'not-found' | 'blocked' }>;

export type FirewallLimiterDeps = {
  check: FirewallCheck;
  /** The current request's headers; only `host` and the client address headers are passed on. */
  requestHeaders: () => Promise<Headers>;
  production: boolean;
  timeoutMs?: number;
  now?: () => number;
  log?: (line: string, fields: { rule: string }) => void;
};

export const FIREWALL_TIMEOUT_MS = 1500;

/** The only request headers the firewall check sees. */
const FORWARDED_HEADERS = ['host', 'x-real-ip', 'x-forwarded-for'] as const;

function pickForwarded(source: Headers): Headers {
  const out = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = source.get(name);
    if (value) out.set(name, value);
  }
  return out;
}

const cleanRuleId = (value: string | undefined) => {
  const id = value?.trim();
  return id ? id : undefined;
};

/** The two windows of signal creation, with their rule ids read from the environment. */
export function signalCreateWindows(
  env: Record<string, string | undefined>,
): FirewallWindow[] {
  const [minute, hour] = SIGNAL_CREATE_LIMITS;
  return [
    {
      name: 'signals-create-minute',
      ruleId: env.WRITE_RATE_RULE_SIGNALS_CREATE_MINUTE,
      window: minute!,
    },
    {
      name: 'signals-create-hour',
      ruleId: env.WRITE_RATE_RULE_SIGNALS_CREATE_HOUR,
      window: hour!,
    },
  ];
}

type FirewallAnswer = 'ok' | 'limited' | 'fallback';

/**
 * A `WriteRateLimiter` over firewall rules, window by window in order:
 *   - limited or `blocked` -> refused, retry after the window length (the firewall gives none);
 *   - `not-found`, an error or the timeout -> that window falls back to memory, one log line;
 *     writes the firewall admitted are counted in memory too, so the fallback shares the budget;
 *   - a window without a rule id, or outside production -> memory.
 * Without any firewall window it is exactly the in-memory limiter. The firewall counts every
 * check, so a refusal by a later window still spends a slot of an earlier one.
 */
export function createFirewallWriteRateLimiter(
  windows: readonly FirewallWindow[],
  deps: FirewallLimiterDeps,
): WriteRateLimiter {
  const rules = windows.map((w) =>
    deps.production ? cleanRuleId(w.ruleId) : undefined,
  );
  if (rules.every((rule) => rule === undefined)) {
    return asWriteRateLimiter(
      createMemoryWriteRateLimiter(
        windows.map((w) => w.window),
        deps.now,
      ),
    );
  }

  const memory = windows.map((w) =>
    createMemoryWriteRateLimiter([w.window], deps.now),
  );
  const timeout = deps.timeoutMs ?? FIREWALL_TIMEOUT_MS;
  const log =
    deps.log ??
    ((line: string, fields: { rule: string }) => console.warn(line, fields));

  async function ask(ruleId: string, key: string): Promise<FirewallAnswer> {
    try {
      const headers = pickForwarded(await deps.requestHeaders());
      const result = await deps.check(ruleId, {
        rateLimitKey: key,
        headers,
        timeout,
      });
      if (result.rateLimited || result.error === 'blocked') return 'limited';
      if (result.error === 'not-found') return 'fallback';
      return 'ok';
    } catch {
      return 'fallback';
    }
  }

  return {
    async take(key): Promise<RateDecision> {
      for (const [i, w] of windows.entries()) {
        const rule = rules[i];
        if (rule !== undefined) {
          const answer = await ask(rule, key);
          if (answer === 'limited') {
            return {
              ok: false,
              retryAfterSeconds: Math.max(
                1,
                Math.ceil(w.window.windowMs / 1000),
              ),
            };
          }
          if (answer === 'ok') {
            // The firewall decides; the write is also counted here, so a fallback later in the
            // same window starts from what this instance already admitted, not from zero.
            memory[i]!.take(key);
            continue;
          }
          log('[rate] fallback', { rule: w.name });
        }
        const slot = memory[i]!.take(key);
        if (!slot.ok) return slot;
      }
      return { ok: true };
    },
  };
}
