# Space Memory Production Checklist

This checklist is for running Space Memory in production with reliable ingestion,
scheduled refresh, and actionable monitoring.

## 1) Required Environment Variables

Set these on the web deployment:

- `HYPHA_SPACE_MEMORY_OPS_SECRET`
  - Shared secret for ops endpoints:
    - `GET /api/v1/ops/space-memory/health`
    - `POST /api/v1/ops/space-memory/refresh-discussions`
    - `POST /api/v1/ops/space-memory/refresh-thread-summaries`
- `HYPHA_CALL_ARTIFACT_INGEST_SECRET`
  - Shared secret for call artifact ingestion endpoint:
    - `POST /api/v1/spaces/[spaceSlug]/call-artifacts`
- `NEXT_PUBLIC_MATRIX_HOMESERVER_URL`
  - Required for Matrix timeline/media fetch and discussion summaries.
- `HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN`
  - Recommended bot/service token for unattended summary refresh jobs.

Optional but useful:

- `OPENROUTER_API_KEY`
  - Enables LLM-backed living thread summaries (falls back to heuristics when unset).
- `OPENROUTER_THREAD_SUMMARY_MODEL`
  - Optional model override for thread summary generation.
- `NEXT_PUBLIC_ENABLE_SPACE_MEMORY=true`
  - Explicitly pins Space Memory to enabled (even though default now enables it).
- `HYPHA_MCP_AUTH_TOKEN`
- `HYPHA_MCP_MATRIX_REQUEST_URL` (or `VERCEL_URL`)

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

## 3) Scheduled Thread Summary Refresh (Automation)

Living thread summaries refresh when chat activity is recorded and via a scheduled
sweep for rows that are due (≥30 minutes since last refresh and ≥1 new message).

- `POST /api/v1/ops/space-memory/refresh-thread-summaries`
- Header:
  - `x-hypha-ops-secret: $HYPHA_SPACE_MEMORY_OPS_SECRET`

Example body:

```json
{
  "limit": 100
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

- Every 30 minutes alongside discussion refresh for active orgs.

## 4) Scheduled Discussion Refresh (Automation)

Use the new ops endpoint:

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

- Every 30 minutes for active orgs.
- Every 2-4 hours for low-activity environments.

## 5) Health + Alerting

Use the new health endpoint:

- `GET /api/v1/ops/space-memory/health`
- Header:
  - `x-hypha-ops-secret: $HYPHA_SPACE_MEMORY_OPS_SECRET`

The response includes:

- `status`: `ok` | `warn` | `critical`
- `readiness`: env/token readiness
- `metrics`: recent ingestion/summaries
- `alerts`: machine-readable warnings/critical issues

### Suggested alert rules

- Page on `status = critical`.
- Warn if `alerts` contains `missing_matrix_bot_token`.
- Warn if `alerts` contains `no_recent_summaries` for > 24h.

## 6) Pagination Discipline for “Everything”

When querying memory via AI/MCP, always paginate until completion:

- `assets_pagination.has_next_page === false`
- Document/member pagination likewise.

## 7) Operational Verification (Go-Live)

1. Call `/api/v1/ops/space-memory/health` and confirm no critical alerts.
2. Run refresh dry-run and verify expected target spaces.
3. Run real refresh and confirm `success_count > 0`.
4. Ingest one synthetic transcript and verify it appears in org memory.
5. Ask AI for “everything this space remembers” and validate multi-page retrieval.
