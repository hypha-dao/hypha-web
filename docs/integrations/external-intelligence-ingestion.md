# External Space Intelligence ingestion

Let an **Intelligence Business App** (IBA) — typically a Lovable app with its own database —
promote **Markdown meaning** into a Hypha Space’s **Space Intelligence** (the Memory tab), without
bucket credentials and without syncing the app’s schema to Hypha.

Operational rows (interviews, scores, PII) stay in the IBA. Hypha stores self-contained Markdown
artifacts. Members publish drafts to `current`; Hypha AI and other apps then read the same files.

The copy-paste spec for an AI coding agent building the other app lives next to the HTTP
route: `apps/web/src/app/api/v1/spaces/[spaceSlug]/intelligence/README.md`.

This is **not** [external signal ingestion](./external-signal-ingestion.md). Signals are board posts.
Intelligence artifacts are files.

---

## How it fits together

```text
IBA local DB  →  Edge Function (API key)  →  POST /api/v1/spaces/{slug}/intelligence
                                                      │
                                                      ▼
                                            draft Markdown in the intelligence bucket
                                                      │
                         space member publishes on the Memory tab (or approves a signal patch)
                                                      ▼
                                            current artifact  ←  Hypha UI / Hypha AI / other IBAs
```

The same key can call hosted MCP (`POST /api/mcp`, `memory.*` only) instead of REST.

---

## Authentication

Same per-space key model as Signals (`x-hypha-api-key: hyk_…` or `Authorization: Bearer hyk_…`).

| Property | Behaviour |
| --- | --- |
| Scope of validity | One space. A key for another space is `403`. |
| Storage | SHA-256 digest only. Plaintext is shown once at issuance. |
| Permissions | `intelligence:read` (list/read). `intelligence:write` (create draft, propose, archive) **implies read**. |
| Publish to `current` | Space members (Privy) only. IBA keys get `403`. |
| Revocation | Immediate — `401`. |

### Getting a key

Keys are issued by Hypha ops (not the space UI):

```bash
curl -X POST https://<hypha-host>/api/v1/ops/spaces/<spaceSlug>/api-keys \
  -H "x-hypha-ops-secret: $HYPHA_SPACE_API_KEY_OPS_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Stakeholder protocol",
    "source": "stakeholder-protocol",
    "scopes": ["intelligence:write"]
  }'
```

`source` is stamped as `source_app` on every write. One **active** key per `source` per space.

List and revoke use the same ops routes as Signals keys.

IBA secrets: `HYPHA_BASE_URL`, `HYPHA_SPACE_SLUG`, `HYPHA_SPACE_API_KEY` (server-side / Edge Function
only — never `VITE_*` / `NEXT_PUBLIC_*`).

---

## What IBAs may do

| Action | How |
| --- | --- |
| List / search / read | `GET /intelligence`, `GET /intelligence/{id}` |
| Create | `POST /intelligence` with `title` + `type` + `body` (or `markdown`). Always **draft**. |
| Propose an update | `POST /signals/{signalSlug}/intelligence-patch` with `action: "propose"`, `target_id`, `expected_sha`, `markdown`. Needs an existing signal. |
| Archive | `DELETE /intelligence/{id}?expectedSha=` |
| Publish / approve | **Not allowed** for the key |

Create and delete (and propose) use content SHA concurrency: mismatch → `409` + `currentSha`.

There is no `externalId` idempotency on intelligence create (unlike Signals).

---

## Stakeholder example

Promote an `assessment` titled `Stakeholder Assessment — Belica 5.0`, optional
`related: ["energy-stakeholder-map"]` if the Energy pack is enabled. Members review the draft on
the Memory tab. Full JSON and Edge Function: the README above.
