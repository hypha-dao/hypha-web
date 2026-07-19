# Space Memory Production Checklist

This checklist is for running Space Memory in production with reliable ingestion,
scheduled refresh, automatic signal orchestration, and actionable monitoring.

## 1) Required Environment Variables

Set these on the web deployment:

- `HYPHA_SPACE_MEMORY_OPS_SECRET`
  - Shared secret for ops endpoints:
    - `GET /api/v1/ops/space-memory/health`
    - `POST /api/v1/ops/space-memory/refresh-discussions`
    - `POST /api/v1/ops/signals/orchestrate`
- `CRON_SECRET`
  - Required for Vercel Cron routes (Vercel sends `Authorization: Bearer $CRON_SECRET`):
    - `GET /api/cron/space-memory-refresh-discussions`
    - `GET /api/cron/signals-orchestrate`
- `HYPHA_CALL_ARTIFACT_INGEST_SECRET`
  - Shared secret for call artifact ingestion endpoint:
    - `POST /api/v1/spaces/[spaceSlug]/call-artifacts`
- `NEXT_PUBLIC_MATRIX_HOMESERVER_URL`
  - Required for Matrix timeline/media fetch and discussion summaries.
- `HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN`
  - Recommended bot/service token for unattended summary refresh jobs.
- `HYPHA_SIGNAL_ORCHESTRATOR_AUTH_TOKEN` or `HYPHA_MCP_AUTH_TOKEN`
  - Service auth used when the orchestrator reads org memory during evaluation.

Optional but useful:

- `NEXT_PUBLIC_ENABLE_SPACE_MEMORY=true`
  - Explicitly pins Space Memory to enabled (even though default now enables it).
- `NEXT_PUBLIC_ENABLE_COHERENCE=true`
  - Required for Signals UI / coherence features.
- `HYPHA_MCP_MATRIX_REQUEST_URL` (or `VERCEL_URL`)
- Signal orchestrator tuning (defaults shown):
  - `HYPHA_SIGNAL_ORCHESTRATOR_WINDOW_MINUTES=20` — debounce before a queued item becomes due
  - `HYPHA_SIGNAL_ORCHESTRATOR_MAX_ATTEMPTS=5`
  - `HYPHA_SIGNAL_ORCHESTRATOR_SPACE_DAILY_LIMIT=3`
  - `HYPHA_SIGNAL_ORCHESTRATOR_RELAY_DAILY_LIMIT=2`

## 2) Ingestion Pipeline (Recordings + Transcripts)

Your recorder/STT worker must call:

- `POST /api/v1/spaces/{spaceSlug}/call-artifacts`
- Header:
  - `x-hypha-ingest-secret: $HYPHA_CALL_ARTIFACT_INGEST_SECRET`

Minimum payload:

```json
{
  "call_session_id": "room-2026-05-16T00:00:00Z",
  "transcript": { "text": "..." }
}
```

Recommended payload includes both `recording` and `transcript`.

Successful memory ingest and discussion-summary writes also **enqueue** a
signal-orchestrator evaluation (`triggerKind: memory_ingest` /
`discussion_summary`). Enqueue alone does not emit a signal — the orchestrate
worker must run after `dueAt`.

## 3) Scheduled Discussion Refresh (Enqueue)

### Preferred: Vercel Cron

Configured in `apps/web/vercel.json`:

- Path: `/api/cron/space-memory-refresh-discussions`
- Default schedule: every 2 hours (`0 */2 * * *`)
- Auth: `CRON_SECRET` (set in the Vercel project)

Requires a Vercel plan that allows sub-daily crons (Pro+ for `*/10` and
`0 */2`). After deploy, confirm the crons appear under Project → Settings →
Crons (or the deployment’s Cron Jobs tab).

### Manual / external scheduler

- `POST /api/v1/ops/space-memory/refresh-discussions`
- Header:
  - `x-hypha-ops-secret: $HYPHA_SPACE_MEMORY_OPS_SECRET`

Example body:

```json
{
  "limit": 100,
  "include_archived": false
}
```

Dry run:

```json
{
  "dry_run": true,
  "limit": 50
}
```

### Suggested schedule

- Every 30 minutes–2 hours for active orgs (Vercel default: 2 hours).
- Every 2–4 hours for low-activity environments.

## 4) Scheduled Signal Orchestration (Generate)

Queued evaluations stay `pending` until `dueAt` (default ~20 minutes after
enqueue). Nothing emits signals unless this worker runs.

### Preferred: Vercel Cron

Configured in `apps/web/vercel.json`:

- Path: `/api/cron/signals-orchestrate`
- Default schedule: every 10 minutes (`*/10 * * * *`)
- Auth: `CRON_SECRET`

### Manual / external scheduler

- `POST /api/v1/ops/signals/orchestrate`
- Header:
  - `x-hypha-ops-secret: $HYPHA_SPACE_MEMORY_OPS_SECRET`

Example body:

```json
{
  "limit": 40,
  "dry_run": false
}
```

### Pipeline summary

```
memory ingest / discussion summary / refresh-discussions
        → enqueueSignalEvaluationFromMemory (pending, dueAt = now + window)
        → signals-orchestrate cron (process due rows)
        → emit space signal and/or ecosystem relay (with cooldowns / daily caps)
```

Spaces must pass payment eligibility; otherwise queue rows are discarded with a
payment reason.

## 5) Health + Alerting

Use the health endpoint:

- `GET /api/v1/ops/space-memory/health`
- Header:
  - `x-hypha-ops-secret: $HYPHA_SPACE_MEMORY_OPS_SECRET`

The response includes:

- `status`: `ok` | `warn` | `critical`
- `readiness`: env/token readiness
- `metrics`: recent ingestion/summaries + signal orchestrator queue depth
- `alerts`: machine-readable warnings/critical issues

### Suggested alert rules

- Page on `status = critical`.
- Warn if `alerts` contains `missing_matrix_bot_token`.
- Warn if `alerts` contains `no_recent_summaries` for > 24h.
- Warn if `signal_orchestrator_queue_pending` keeps growing (orchestrate cron not running).
- Warn if `signal_orchestrator_failed_jobs` / `queue_failed` > 0.

## 6) Pagination Discipline for “Everything”

When querying memory via AI/MCP, always paginate until completion:

- `assets_pagination.has_next_page === false`
- Document/member pagination likewise.

## 7) Operational Verification (Go-Live)

1. Confirm `CRON_SECRET`, `HYPHA_SPACE_MEMORY_OPS_SECRET`, and Matrix bot token are set in production.
2. Confirm Vercel Cron jobs for refresh + orchestrate are listed and enabled.
3. Call `/api/v1/ops/space-memory/health` and confirm no critical alerts.
4. Run refresh dry-run and verify expected target spaces.
5. Run real refresh and confirm `success_count > 0` (or ingest a transcript).
6. Wait for `dueAt` (or lower `HYPHA_SIGNAL_ORCHESTRATOR_WINDOW_MINUTES` in a staging env), then hit orchestrate (cron or ops POST) and confirm queue items move off `pending`.
7. Ask AI for “everything this space remembers” and validate multi-page retrieval.
