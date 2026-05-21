# Technical Specification — MCP tool `get_people_by_space_slug`

## Document control

| Field | Value |
|-------|--------|
| **Status** | Ready for implementation |
| **Epic** | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027) |
| **Scope** | Read-only MCP tool listing **all members of the active space** identified by slug: **people members** and **other spaces that are members** (same cohort as the Members tab), with **full `memberships` row fields** where applicable and deterministic JSON output |
| **Parity** | Follow the **same structural pattern** as the existing `get_spaces` tool: Zod `inputSchema` / `outputSchema`, `structuredContent`, read-only semantics, tests, and error shapes |

---

## 1) Problem statement

Assistants need a **typed, paginated** way to answer “who is in this space?” for the **currently selected space**, including:

- **People** who hold membership, and  
- **Other spaces** that are members of that space (space-as-member rows in the product UI),

with **join timing** and **full membership context**, without confusing this with **child spaces** (subspaces in the hierarchy). **Do not** return “members of child spaces” as a substitute for the active space’s roster.

---

## 2) Source of truth (data model)

### 2.1 Product reference (Members tab)

The in-app Members list is implemented by **`GET /api/v1/spaces/[spaceSlug]/members`** (`apps/web/src/app/api/v1/spaces/[spaceSlug]/members/route.ts`):

1. Resolve the host space by slug.
2. Read the **on-chain member address list** from `getSpaceDetails` / space contract (`members` tuple).
3. Split addresses into:
   - **`findPersonByAddresses`** → people members (`persons` in the JSON response).
   - **`findSpaceByAddresses`** → nested **spaces** whose `spaces.web3_address` matches a member address (`spaces` in the JSON response).

**This is the roster of the active space.** It is **not** “all people who belong to a child space” and **not** “enumerate child spaces by `parent_id`” unless product explicitly asks for hierarchy elsewhere.

UI cards: `MembersList` renders `persons` via `MemberCard` and `spaces` via `SpaceMemberCard` (`packages/epics/src/people/components/members-list.tsx`). Join timestamps for display are resolved via **`useEvents`** (`type: 'joinSpace'`, `referenceEntity: 'space'`) in those components — the MCP tool SHOULD surface join time in a way that matches this **when event data is available** (see §4.2).

### 2.2 Database: `memberships` (“member table”)

The PostgreSQL table is **`memberships`** (`packages/storage-postgres/src/schema/membership.ts`). Product language **“member table”** maps to this table.

| Column (DB) | Notes |
|-------------|--------|
| `id` | Serial primary key |
| `person_id` | FK → `people.id` |
| `space_id` | FK → `spaces.id` (host space) |
| `created_at` | Membership created (join time when synced to DB) |
| `updated_at` | Last update |

**FR (full context):** For each **person** member returned, the tool SHALL include **every column** from the matching `memberships` row for `(person_id, host space_id)` when such a row exists. Serialize column names in API output using a **single consistent convention** (recommended: **snake_case** `id`, `person_id`, `space_id`, `created_at`, `updated_at` to match SQL and avoid ambiguity with nested objects).

If a person appears on-chain but has **no** `memberships` row yet, represent membership as **`null`** and set flags in metadata (see §4.2) — do not invent IDs.

For **space-type** members (another space’s treasury address in the on-chain list), there is typically **no** `person_id`; the Members tab still shows them via `findSpaceByAddresses`. Unless the schema is extended to link space-as-member to `memberships`, the tool SHALL return **`membership: null`** for those entries and still return **full space profile fields** from `spaces` (see §4.2). If product later adds a dedicated row type, revise this spec in a follow-up ticket.

### 2.3 `people` and `spaces` profile tables

- **`people`**: attributes for person members (see §4.2).  
- **`spaces`**: attributes for space-type members (title, description, slug, `logo_url`, `web3_address`, `parent_id`, flags, etc.).

### 2.4 Explicit non-requirements (correcting the earlier mistake)

| Incorrect interpretation | Correct interpretation |
|--------------------------|-------------------------|
| Include “members of **child spaces**” of the active space | **Exclude.** Roster = members **of** the active space only. |
| Child spaces appear only via `parent_id` | Child spaces are a **hierarchy** concern; **not** the same as “Space” badge members, which are **other spaces whose address is in the on-chain member set** for the host space. |

### 2.5 Activity-signal quality policy (AI context)

This tool is roster-focused, but assistants often combine roster + activity context.
For AI quality and cost control, activity context linked to members MUST be **high signal**
and MUST exclude telemetry/debug noise.

**Exclude as noise (do not model as activity facts):**

- UI/session telemetry (clicks, scroll depth, panel open/close, viewport dimensions)
- low-level delivery mechanics (typing indicators, reconnect churn, read-receipt internals)
- transient presence chatter (heartbeat/ping noise, reconnect join/leave flaps)
- debug/trace internals (stack traces, retry internals, verbose transport logs)
- redundant snapshots (full-state repeats without meaningful semantic change)
- raw binary payloads as activity records (store URI/metadata/transcript, not media bytes)
- duplicate cross-channel copies without new context
- non-essential PII (device IDs, IPs, user-agent strings) unless explicitly approved

**Keep as required activity intelligence (when included by sibling tools):**

- actor + action + timestamp + canonical reference (`space_slug`, `doc slug`, `asset_key`, `call_session_id`)
- decision artifacts (proposal/vote/outcome/rationale)
- conversation intelligence (summary, key quotes, participant set)
- call intelligence (transcript, summary, action items, recording URI)
- meaningful document deltas (semantic revision events, not keystroke logs)
- task lifecycle transitions (opened/assigned/completed/blocked)

Rule: if a record cannot help answer **what happened, why, and what changed**, it is out of scope for AI memory context.

---

## 3) Functional requirements

| ID | Requirement |
|----|----------------|
| **FR-1** | The system SHALL expose an MCP tool named **`get_people_by_space_slug`** (name retained for epic traceability; description SHOULD clarify it returns **people and space members**). |
| **FR-2** | The tool SHALL be **read-only** and **idempotent** (no writes, no side effects). |
| **FR-3** | Given a valid space slug, the tool SHALL return the active space’s **full member roster** aligned with §2.1: **people** and **spaces-as-members**, not child-space membership trees. |
| **FR-4** | For each **person** member, the tool SHALL include the **complete `memberships` record** (all columns in §2.2) when present in DB, plus person profile fields needed for assistants. |
| **FR-5** | For each **space** member, the tool SHALL include **complete `spaces` row fields** (or the same field set as `findSpaceByAddresses` / `getSpaceDefaultFields` in core), plus optional join metadata. |
| **FR-6** | **`joined_at` / join display:** Prefer **`memberships.created_at`** for people when a row exists; for space members or when events are required for parity with the UI, include **`join_source`** (`"membership" \| "event" \| "unknown"`) and ISO timestamps when available. |
| **FR-7** | The tool SHALL support **pagination** consistent with `get_spaces` (same caps and defaults unless a shared MCP pagination utility defines otherwise). Pagination MAY apply to a **merged** list in stable sort order (document order: e.g. people first, then spaces; or interleaved by join time — **pick one and test it**). |
| **FR-8** | The tool SHALL return explicit **`source`** metadata: at minimum `source: "db"` for database-backed fields and, if chain reads are used for the roster, **`source_chain: "rpc"`** (or the epic’s standard enum) for the address list — see epic “source metadata” rules. |
| **FR-9** | The tool SHALL include **`asOf`** (ISO-8601 UTC timestamp of the read). |
| **FR-10** | When the slug does not match a space, the tool SHALL return a **not-found** result; structured payload MUST match the convention used by `get_spaces`. |
| **FR-11** | Invalid slug input SHALL fail validation **before** database or RPC access (same slug validation pattern as `get_spaces` / chat tools). |
| **FR-12** | Any optional member-activity metadata exposed by this tool or adjacent aggregators SHALL follow §2.5 signal policy: include only semantic activity events and exclude telemetry/debug noise. |

---

## 4) Contract (Zod + MCP registration)

### 4.1 Input schema (illustrative — align field names with `get_spaces`)

```typescript
z.object({
  space_slug: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .describe('Hypha space slug of the active space, e.g. "hypha"'),
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(100).optional().default(20),
});
```

**Do not** add `include_child_spaces` or similar — it is out of scope and was the source of the spec mistake.

### 4.2 Output schema (structured content)

Minimum shape (names are illustrative; keep **all `memberships` columns** on `membership` when non-null):

```typescript
z.object({
  found: z.boolean(),
  space_slug: z.string(),
  space: z
    .object({
      id: z.union([z.string(), z.number()]),
      slug: z.string(),
      title: z.string().optional(),
      parent_id: z.union([z.string(), z.number()]).nullable().optional(),
    })
    .nullable(),
  source: z.literal('db'), // extend per FR-8 if multi-source
  asOf: z.string().datetime(),
  // Unified roster; discriminated by member_kind
  members: z.array(
    z.discriminatedUnion('member_kind', [
      z.object({
        member_kind: z.literal('person'),
        // Full memberships table — all columns from schema/membership.ts
        membership: z
          .object({
            id: z.number(),
            person_id: z.number(),
            space_id: z.number(),
            created_at: z.string().datetime(),
            updated_at: z.string().datetime(),
          })
          .nullable(),
        join_source: z.enum(['membership', 'event', 'unknown']),
        joined_at: z.string().datetime().nullable(),
        person: z.object({
          /* all public people columns used elsewhere in APIs, ISO dates */
        }),
      }),
      z.object({
        member_kind: z.literal('space'),
        membership: z.null(), // unless schema extended
        join_source: z.enum(['event', 'unknown']),
        joined_at: z.string().datetime().nullable(),
        space: z.object({
          /* full space row fields aligned with findSpaceByAddresses / Space type */
        }),
      }),
    ]),
  ),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    total_pages: z.number(),
    has_next_page: z.boolean(),
    has_previous_page: z.boolean(),
  }),
});
```

**Delegate / voting context** (shown in UI for space cards): optional Phase-2 enrichment via web3 reads (`useSpaceDelegate` pattern). Do not block MCP v1 on delegate; document as follow-up if not in scope.

**Privacy / RLS:** Same rules as other read tools; omit `people.sub` unless explicitly approved.

### 4.3 Human-readable `content`

Short summary: counts of **people** vs **space** members on this page, plus host space slug.

### 4.4 Registration

Register the tool next to `get_spaces` using the **same server bootstrap** (transport, auth, error middleware).

---

## 5) Implementation plan (packages)

1. **Core / shared service**
   - Implement a single function used by MCP (and optionally chat) that:
     - Loads host space by slug.
     - Fetches on-chain member addresses (reuse logic from `members/route.ts`).
     - Partitions into people vs spaces (reuse `findPersonByAddresses` / `findSpaceByAddresses` or equivalent batched queries).
     - Left-joins **`memberships`** for people to attach **full row** fields.
     - Optionally loads **join events** for parity with `SpaceMemberCard` / `MemberCard`.
   - Centralize sorting + pagination so MCP and HTTP API stay aligned.

2. **MCP server**
   - Zod parse → call shared function → map to output schema → `{ content, structuredContent }`.

3. **Tests**
   - Success with **only people**, **only spaces**, **mixed**; not-found slug; invalid slug; pagination; missing `memberships` row for an on-chain person.

---

## 5.1) Sibling tool — `get_org_memory_by_space_slug`

The org-memory umbrella tool (**v1**) returns the **same `members` + `pagination` semantics** as this spec, plus **`org_memory_assets: []`** until the org memory catalogue exists. See [mcp-get-org-memory-by-space-slug-tech-spec.md](./mcp-get-org-memory-by-space-slug-tech-spec.md).

---

## 6) Non-functional requirements

| ID | Requirement |
|----|----------------|
| **NFR-1** | Deterministic date serialization: UTC ISO-8601 strings. |
| **NFR-2** | Bounded `page_size`. |
| **NFR-3** | No secrets in structured output. |
| **NFR-4** | Activity context quality: semantic, deduplicated, retrieval-ready references only; no telemetry/debug noise (§2.5). |

---

## 7) Acceptance criteria

- [ ] Tool lists **people and space members** for the active slug, not child-space populations.
- [ ] Each person entry includes **all `memberships` columns** when a DB row exists.
- [ ] Each space entry includes full **space** profile fields for the member space.
- [ ] `structuredContent` validates against the output schema.
- [ ] Automated tests cover mixed rosters and pagination.
- [ ] Any activity context attached to members excludes noise classes in §2.5 and preserves canonical retrieval IDs.

---

## 8) Traceability

| Epic item | This spec |
|-----------|-----------|
| Phase 1 — `get_people_by_space_slug` | §3–§7 |
| Strict typed contracts | §4 |
| Read-only / idempotent | FR-2 |
| Source metadata + `asOf` | FR-8–FR-9 |

---

## 9) Open questions

1. **Unified pagination:** Interleaved vs two-section pagination — choose one and mirror in chat tool output.
2. **Delegate enrichment** for MCP: include in v1 or defer to Phase 2.
