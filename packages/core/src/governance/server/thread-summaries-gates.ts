export const THREAD_SUMMARY_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
export const THREAD_SUMMARY_MIN_MESSAGES = 3;
export const THREAD_SUMMARY_MATRIX_MAX_PAGES = 8;

export function shouldRefreshThreadSummary(params: {
  lastMessageOriginServerTs: number | null | undefined;
  lastSummarizedOriginServerTs: number | null | undefined;
  lastRefreshedAt: string | null | undefined;
  nowMs?: number;
  force?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (params.force) return { ok: true };
  const lastMessageTs = params.lastMessageOriginServerTs ?? null;
  if (lastMessageTs == null || lastMessageTs <= 0) {
    return { ok: false, reason: 'no_thread_activity' };
  }
  const lastSummarizedTs = params.lastSummarizedOriginServerTs ?? null;
  if (lastSummarizedTs != null && lastSummarizedTs >= lastMessageTs) {
    return { ok: false, reason: 'no_new_messages' };
  }
  const lastRefreshedAt = params.lastRefreshedAt?.trim();
  if (lastRefreshedAt) {
    const refreshedMs = Date.parse(lastRefreshedAt);
    if (
      Number.isFinite(refreshedMs) &&
      (params.nowMs ?? Date.now()) - refreshedMs <
        THREAD_SUMMARY_REFRESH_INTERVAL_MS
    ) {
      return { ok: false, reason: 'rate_limited' };
    }
  }
  return { ok: true };
}
