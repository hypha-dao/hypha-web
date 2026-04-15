import type { MatrixOrgMemoryFetchMeta } from '@hypha-platform/core/server';

/**
 * Human-readable Matrix diagnostics when no media rows were produced (MCP summary line).
 */
export function buildMatrixDiagnosticHint(
  mf: MatrixOrgMemoryFetchMeta | null,
): string {
  if (!mf || mf.media_events_yielded !== 0) {
    return '';
  }

  const attemptPart = mf.attempted
    ? `attempted (HTTP ${mf.http_status ?? 'n/a'}, events ${
        mf.events_in_chunk
      })`
    : 'not attempted';

  const skipped = mf.skipped_reason ? ` — ${mf.skipped_reason}` : '';
  const sessionUsed = mf.used_session_matrix_token
    ? ' — used_session_matrix_token'
    : '';
  const sessionUnavailable = mf.session_matrix_token_unavailable
    ? ' — session_matrix_token_unavailable (Human Chat Matrix link missing or expired)'
    : '';
  const tokenHint =
    mf.skipped_reason === 'missing_access_token' &&
    !mf.used_session_matrix_token &&
    !mf.session_matrix_token_unavailable
      ? ' — set HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN (bot) or pass Privy JWT + app URL for per-user Matrix (Hypha Chat / MCP)'
      : '';
  const errPart = mf.error ? ` — ${mf.error}` : '';

  return ` Matrix: ${attemptPart}${skipped}${sessionUsed}${sessionUnavailable}${tokenHint}${errPart}.`;
}
