# Technical Specification — MCP tool `get_people_by_space_slug`

## Document control

| Field | Value |
|-------|--------|
| **Status** | Ready for implementation |
| **Epic** | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027) |
| **Scope** | Read-only MCP tool listing people who are members of a space (by slug), including membership join metadata and deterministic JSON output |
| **Parity** | Follow the **same structural pattern** as the existing `get_spaces` tool: Zod `inputSchema` / `outputSchema`, `structuredContent`, read-only semantics, tests, and error shapes |

---

## 1) Problem statement

Assistants need a **typed, paginated** way to answer “who is in this space?” and “when did they join?” using **database membership** as the source of truth, without ad-hoc SQL or incomplete summaries from aggregate counts alone.

---

## 2) Source of truth (data model)

### 2.1 Tables (PostgreSQL / Drizzle)

- **`memberships`** (`packages/storage-postgres/src/schema/membership.ts`):
  - `id` (serial)
  - `person_id` → `people.id`
  - `space_id` → `spaces.id`
  - `created_at`, `updated_at` (`commonDateFields`)
- **Joining date** for a person in a space SHALL be **`memberships.created_at`** (first insert wins; unique index on `(person_id, space_id)`).

- **`people`** (`packages/storage-postgres/src/schema/people.ts`): profile fields exposed as person attributes in the tool output.

- **`spaces`** (`packages/storage-postgres/src/schema/space.ts`): resolved by **`spaces.slug`** to obtain `space_id` and optional parent/title metadata for the response envelope.

### 2.2 Existing core query (gap)

`findPeopleBySpaceSlug` in `packages/core/src/people/server/queries.ts` returns **people only** and does **not** surface membership `id` or `created_at`. Implementation SHALL extend or replace this path so each row includes **full membership fields** plus **full person fields** required by the contract below.

### 2.3 “Spaces that are members”

The relational model links **people** to spaces via `memberships`. If product semantics require **child spaces** (rows in `spaces` with `parent_id` = parent space) to appear alongside people, expose them behind an explicit input flag (see §4.1) and document that this is **hierarchical**, not a second row in `memberships`. If that is out of scope for Phase 1, omit the flag and return **people members only**; do not block shipping the tool.

---

## 3) Functional requirements

| ID | Requirement |
|----|----------------|
| **FR-1** | The system SHALL expose an MCP tool named **`get_people_by_space_slug`**. |
| **FR-2** | The tool SHALL be **read-only** and **idempotent** (no writes, no side effects). |
| **FR-3** | Given a valid space slug, the tool SHALL return **members** as an ordered list of objects, each containing **all columns** from the `memberships` row for that person–space pair and **all public person columns** needed for assistant use (see §5). |
| **FR-4** | Each member object SHALL include **`joinedAt`** as ISO-8601 UTC, derived from **`memberships.created_at`**. |
| **FR-5** | The tool SHALL support **pagination** consistent with `get_spaces` (same caps and defaults unless a shared MCP pagination utility defines otherwise). |
| **FR-6** | The tool SHALL return explicit **`source: "db"`** and **`asOf`** (ISO-8601 UTC timestamp of the read) in `structuredContent`, per epic normalization rules. |
| **FR-7** | When the slug does not match a space, the tool SHALL return a **not-found** result (HTTP-level behavior follows the MCP transport; structured payload MUST include `found: false` or equivalent agreed convention used by `get_spaces`). |
| **FR-8** | Invalid slug input SHALL fail validation **before** database access (same slug validation pattern as `get_spaces` / chat tools). |

---

## 4) Contract (Zod + MCP registration)

### 4.1 Input schema (illustrative — align field names with `get_spaces`)

```typescript
// Illustrative; match project conventions and shared pagination types.
z.object({
  space_slug: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .describe('Hypha space slug, e.g. "hypha"'),
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(100).optional().default(20),
  // Optional Phase-1b:
  // include_child_spaces: z.boolean().optional().default(false),
});
```

### 4.2 Output schema (structured content)

Minimum shape:

```typescript
z.object({
  found: z.boolean(),
  space_slug: z.string(),
  space: z
    .object({
      id: z.string(), // or number — match get_spaces numeric policy
      slug: z.string(),
      title: z.string().optional(),
      parent_id: z.string().nullable().optional(),
    })
    .nullable(),
  source: z.literal('db'),
  asOf: z.string().datetime(), // ISO UTC
  members: z.array(
    z.object({
      membership: z.object({
        id: z.number(),
        person_id: z.number(),
        space_id: z.number(),
        created_at: z.string().datetime(),
        updated_at: z.string().datetime(),
      }),
      person: z.object({
        id: z.number(),
        slug: z.string().nullable(),
        name: z.string().nullable(),
        surname: z.string().nullable(),
        nickname: z.string().nullable(),
        email: z.string().nullable(),
        description: z.string().nullable(),
        location: z.string().nullable(),
        avatar_url: z.string().nullable(),
        lead_image_url: z.string().nullable(),
        web3_address: z.string().nullable(),
        links: z.array(z.string()),
        created_at: z.string().datetime(),
        updated_at: z.string().datetime(),
      }),
    }),
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

**Privacy / RLS:** If `people` rows are subject to RLS, the MCP server’s DB role MUST match the same access rules as other read tools; redact or omit fields that must not leak (align with `get_spaces`).

### 4.3 Human-readable `content`

Set MCP `content` to a short summary string (e.g. member count, page info) so non-structured clients still get a useful message. Mirror `get_spaces` wording style.

### 4.4 Registration

Register the tool next to `get_spaces` using the **same server bootstrap** (transport, auth header forwarding, error middleware). File paths depend on the branch that contains the MCP server (see epic PR [#2031](https://github.com/hypha-dao/hypha-web/pull/2031) and related branches such as `litzi/feat/mcp-server`).

---

## 5) Implementation plan (packages)

1. **`@hypha-platform/core`**
   - Add e.g. `findMembersWithMembershipBySpaceSlug` (name TBD) in `packages/core/src/people/server/queries.ts` (or a dedicated module) that:
     - Resolves `space_id` by slug (reuse `findSpaceBySlug` or a lightweight `select id, slug, title, parent_id from spaces where slug = ?`).
     - Joins `memberships` ↔ `people` with `where memberships.space_id = :spaceId`.
     - Selects **explicit columns** for both tables (avoid `select *` in public API surfaces).
     - Applies `limit` / `offset` and a **window count** for total (same pattern as existing `getDefaultFields()` + `count(*) over()`).
   - Export from `packages/core/src/people/server/index.ts` (or the established barrel) for MCP and tests.

2. **MCP server package / route**
   - Add tool definition mirroring `get_spaces`: Zod parse → call core with `{ db }` → map DB dates to ISO strings → return `{ content, structuredContent }` per SDK expectations.

3. **Tests**
   - Unit or integration tests: success (1+ members), empty list, slug not found, invalid slug, pagination boundary, optional RLS-denied behavior if test DB supports it.

---

## 6) Non-functional requirements

| ID | Requirement |
|----|----------------|
| **NFR-1** | Deterministic date serialization: always UTC ISO-8601 strings in outputs. |
| **NFR-2** | Bounded `page_size` to protect DB and MCP latency. |
| **NFR-3** | No secrets in structured output (no raw `sub` / internal tokens unless already exposed elsewhere by policy). |

---

## 7) Acceptance criteria

- [ ] Tool appears in MCP tool list alongside `get_spaces`.
- [ ] Valid slug returns `structuredContent` validating against the output schema.
- [ ] `joinedAt` / `membership.created_at` matches DB for sampled rows.
- [ ] Unknown slug returns not-found without throwing (unless `get_spaces` throws — stay consistent).
- [ ] Automated tests cover success, not-found, invalid input, and pagination.

---

## 8) Traceability

| Epic item | This spec |
|-----------|-----------|
| Phase 1 — `get_people_by_space_slug` | §3–§7 |
| Strict typed contracts (`inputSchema`, `outputSchema`, `structuredContent`) | §4 |
| Read-only / idempotent | FR-2, §2 |
| Source metadata `db` + `asOf` | FR-6, output schema |

---

## 9) Open questions (resolve before or during implementation)

1. Should **`people.sub`** ever be returned to MCP clients? Default: **omit** unless product confirms parity with another public API.
2. Should **child spaces** be included in v1? If yes, define a separate array `child_spaces` with `{ id, slug, title, … }` and keep `members` for people only.
