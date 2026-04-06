# Technical Specification — Chat AI integration for `get_people_by_space_slug`

## Document control

| Field | Value |
|-------|--------|
| **Status** | Ready for implementation |
| **Epic** | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027) |
| **Depends on** | MCP tool `get_people_by_space_slug` (see `mcp-get-people-by-space-slug-tech-spec.md`) and core query that returns membership + person rows |
| **Reference implementation** | `apps/web/src/app/api/chat/route.ts` — pattern for `get_space_by_slug` tool + `buildSystemPrompt` |

---

## 1) Objective

Enable **Hypha AI** (OpenRouter / AI SDK `streamText` in the chat route) to answer questions such as:

- “Who are the members of this space?”
- “When did `<person>` join?”
- “How many members are there?” (with optional follow-up pagination)

without hallucinating membership: the model MUST call a **server-side tool** backed by the same DB membership data as the MCP tool.

---

## 2) Parity with MCP

| Concern | Approach |
|---------|----------|
| **Data** | Reuse **`@hypha-platform/core`** server query (e.g. `findMembersWithMembershipBySpaceSlug`) — **do not** duplicate SQL in the route. |
| **Shape** | Map tool output to the **same field names and date normalization** as the MCP `structuredContent` (single mapping helper in core or a small shared `packages/core` formatter is acceptable). |
| **Auth** | Chat already requires `Authorization: Bearer <Privy JWT>`. Membership reads MUST respect the same DB/RLS context as other authenticated chat operations. |

---

## 3) Functional requirements

| ID | Requirement |
|----|----------------|
| **FR-C1** | The chat route SHALL register a tool **`get_people_by_space_slug`** (snake_case key in `tools` map, consistent with `get_space_by_slug`). |
| **FR-C2** | The tool’s `inputSchema` SHALL accept at least **`space_slug`**, **`page`**, and **`page_size`** (names aligned with MCP). |
| **FR-C3** | When `spaceSlug` is present in the chat request body, the system prompt SHOULD instruct the model to **prefer** that slug for space-scoped membership questions without asking the user to repeat it. |
| **FR-C4** | The tool description SHALL state: read-only; lists members with **join date** from membership; supports pagination; use when users ask about **roster**, **join dates**, or **who belongs** to a space. |
| **FR-C5** | Errors from the DB layer SHALL be returned as structured tool results (`found: false` / `error` string), not thrown into the model stream, **matching the error style of `get_space_by_slug`** in the same file. |

---

## 4) Implementation steps (`apps/web/src/app/api/chat/route.ts`)

1. **Import** the core function that lists members with membership metadata (added per MCP spec).

2. **Define** `getPeopleBySpaceSlugTool` (name mirrors MCP tool for mental alignment):
   - `description`: clear triggers (“members”, “joined”, “roster”, “who is in”).
   - `inputSchema`: Zod object per §3 of the MCP spec (subset is acceptable if chat caps page_size lower than MCP).

3. **`execute`**:
   - Parse and sanitize slug (reuse `sanitizeSlug` or the same regex as existing tools).
   - Call core with `{ db }` from `@hypha-platform/storage-postgres` (same import pattern as other server usage in the codebase — follow existing `getSpaceBySlug` import from `@hypha-platform/core/server`).
   - Map dates with `new Date(x).toISOString()` for all datetime fields.
   - Return `{ found, space_slug, space, source: 'db', asOf: new Date().toISOString(), members, pagination }`.

4. **Register** in `streamText({ tools: { … } })`:
   ```typescript
   tools: {
     get_space_by_slug: getSpaceBySlugTool,
     get_people_by_space_slug: getPeopleBySpaceSlugTool,
   },
   ```

5. **`buildSystemPrompt`** — extend the branch when `spaceSlug` is set, e.g. add one sentence:

   > For questions about **who is a member**, **membership**, or **join dates**, use the `get_people_by_space_slug` tool with `space_slug` set to the slug above. Use `get_space_by_slug` for high-level space metadata and counts.

   Keep prompts minimal; avoid duplicating full tool schemas in the prompt.

6. **`stopWhen` / step budget** — if membership queries often need a follow-up page, consider raising `stepCountIs(n)` slightly or document that the model should pass `page` — align with product tolerance for latency (current: `stepCountIs(5)`).

---

## 5) Testing

| Test | Expected |
|------|----------|
| Manual / integration | Authenticated POST to `/api/chat` with `spaceSlug` set asks “list members”; model invokes `get_people_by_space_slug` with correct slug. |
| Unit (optional) | Mock core: tool returns deterministic JSON; Zod schema accepts output. |

E2E: add a Playwright or API test only if the repo already tests `/api/chat` tools; otherwise document manual QA steps for the first release.

---

## 6) Acceptance criteria

- [ ] New tool appears in the `tools` object and is invokable by the model for membership prompts.
- [ ] System prompt mentions when to use `get_people_by_space_slug` vs `get_space_by_slug`.
- [ ] Output includes **join time** from `memberships.created_at` for at least one fixture space in dev/staging.
- [ ] No duplicate Drizzle queries inlined in the route — core is single source of truth.

---

## 7) Traceability

| Epic Phase 4 item | This spec |
|-------------------|-----------|
| Chat route integration with updated tool guidance | §4, §6 |
| Access control parity | §2 Auth / RLS |
