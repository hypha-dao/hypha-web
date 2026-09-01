/**
 * Minimal ISO-8601 duration → milliseconds parser for env-configured windows
 * (e.g. `PT6H`, `P1D`, `PT90M`, `P1DT12H`). Supports day/hour/minute/second components; weeks,
 * months and years are intentionally unsupported (ambiguous for a debounce window). Same
 * notation #2470's digest window uses (decisions D2).
 */
const ISO_DURATION_RE =
  /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export function parseIso8601DurationToMs(value: string): number | null {
  const trimmed = value.trim().toUpperCase();
  const match = ISO_DURATION_RE.exec(trimmed);
  if (!match || trimmed === 'P' || trimmed === 'PT') return null;

  const [, d, h, m, s] = match;
  const days = d ? Number.parseFloat(d) : 0;
  const hours = h ? Number.parseFloat(h) : 0;
  const minutes = m ? Number.parseFloat(m) : 0;
  const seconds = s ? Number.parseFloat(s) : 0;

  const ms = ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
  return ms > 0 ? ms : null;
}

/** Resolve the reconcile window from env, falling back to `PT6H` (spec §13). */
export function resolveReconcileWindowMs(): number {
  const fallback = 6 * 60 * 60 * 1000;
  const raw = process.env.NOTIFICATION_RECONCILE_WINDOW?.trim();
  if (!raw) return fallback;
  return parseIso8601DurationToMs(raw) ?? fallback;
}
