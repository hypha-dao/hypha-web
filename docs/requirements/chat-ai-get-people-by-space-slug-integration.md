# Technical Specification — Chat AI integration for `get_people_by_space_slug`

## Document control

| Field | Value |
|-------|--------|
| **Status** | Ready for implementation |
| **Epic** | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027) |
| **Depends on** | MCP tool `get_people_by_space_slug` (see `mcp-get-people-by-space-slug-tech-spec.md`) and the shared core implementation that mirrors **`GET /api/v1/spaces/[spaceSlug]/members`** |
| **Reference implementation** | `apps/web/src/app/api/chat/route.ts` — pattern for `get_space_by_slug` tool + `buildSystemPrompt` |

---

## 1) Objective

Enable **Hypha AI** (OpenRouter / AI SDK `streamText` in the chat route) to answer questions such as:

- “Who are the members of this space?”
- “Which **spaces** are members here?” (space-as-member rows, as in the Members tab)
- “When did `<person>` join?”
- “How many members are there?” (with optional follow-up pagination)

without hallucinating membership: the model MUST call a **server-side tool** backed by the **same roster semantics** as the MCP tool and the Members tab API.

**Clarification:** The roster is **members of the active space** — **people** and **other spaces that are members** — **not** “everyone who belongs to child spaces” and **not** listing child spaces as a proxy for membership.

---

## 2) Parity with MCP and product

| Concern | Approach |
|---------|----------|
| **Data** | Reuse the **same `@hypha-platform/core` / shared function** as the MCP tool (single implementation). **Do not** duplicate SQL or RPC orchestration in the chat route. Baseline behavior SHOULD match `apps/web/src/app/api/v1/spaces/[spaceSlug]/members/route.ts` (on-chain address list → people vs spaces). |
| **Membership fields** | For each **person** member, include **all columns from `memberships`** when present (see MCP spec §2.2 / §4.2). |
| **Shape** | Map tool output to the **same field names and date normalization** as the MCP `structuredContent`. |
| **Auth** | Chat already requires `Authorization: Bearer <Privy JWT>`. Respect the same access checks as other authenticated chat operations (`checkSpaceAccess` parity where applicable for the host space). |

---

## 3) Functional requirements

| ID | Requirement |
|----|----------------|
| **FR-C1** | The chat route SHALL register a tool **`get_people_by_space_slug`** (snake_case key in `tools` map, consistent with `get_space_by_slug`). |
| **FR-C2** | The tool’s `inputSchema` SHALL accept at least **`space_slug`**, **`page`**, and **`page_size`** (names aligned with MCP). |
| **FR-C3** | When `spaceSlug` is present in the chat request body, the system prompt SHOULD instruct the model to **prefer** that slug for space-scoped membership questions without asking the user to repeat it. |
| **FR-C4** | The tool description SHALL state: read-only; returns **people members and space members** of the **active** space (Members tab parity); includes **full `memberships` row** for people when stored in DB; supports pagination; use for **roster**, **which nested spaces are members**, **join timing**, and **who belongs**. |
| **FR-C5** | Errors from the DB or RPC layer SHALL be returned as structured tool results (`found: false` / `error` string), not thrown into the model stream, **matching the error style of `get_space_by_slug`** in the same file. |

---

## 4) Implementation steps (`apps/web/src/app/api/chat/route.ts`)

1. **Import** the shared function that implements the MCP spec (roster + full `memberships` for people + space profiles for space members).

2. **Define** `getPeopleBySpaceSlugTool`:
   - `description`: triggers (“members”, “roster”, “who is in”, “spaces that are members”, “nested space members”).
   - `inputSchema`: Zod object per MCP §4.1.

3. **`execute`**:
   - Parse and sanitize slug (reuse `sanitizeSlug` or the same regex as existing tools).
   - Call shared implementation with `{ db }` and any RPC client the core layer requires (mirror `members/route.ts` dependencies).
   - Map dates with `new Date(x).toISOString()` for all datetime fields.
   - Return the same object shape as MCP: `{ found, space_slug, space, source, asOf, members, pagination }` where `members` is the **discriminated union** from the MCP spec (people vs spaces).

4. **Register** in `streamText({ tools: { … } })`:
   ```typescript
   tools: {
     get_space_by_slug: getSpaceBySlugTool,
     get_people_by_space_slug: getPeopleBySpaceSlugTool,
   },
   ```

5. **`buildSystemPrompt`** — extend the branch when `spaceSlug` is set, e.g.:

   > For questions about **who belongs to this space**, **people members**, **spaces that are members**, or **join times**, use `get_people_by_space_slug` with `space_slug` set to the slug above. Use `get_space_by_slug` for high-level space metadata and aggregate counts.

6. **`stopWhen` / step budget** — if membership queries often need a follow-up page, consider raising `stepCountIs(n)` slightly or document that the model should pass `page` (current: `stepCountIs(5)`).

---

## 5) Testing

| Test | Expected |
|------|----------|
| Manual / integration | Authenticated POST to `/api/chat` with `spaceSlug` set asks “list members and any spaces that are members”; model invokes `get_people_by_space_slug` with correct slug. |
| Unit (optional) | Mock core: tool returns deterministic JSON; Zod schema accepts output. |

E2E: add a Playwright or API test only if the repo already tests `/api/chat` tools; otherwise document manual QA steps for the first release.

---

## 6) Acceptance criteria

- [ ] New tool appears in the `tools` object and is invokable by the model for membership prompts.
- [ ] System prompt distinguishes **`get_people_by_space_slug`** (roster: people + space members) vs **`get_space_by_slug`** (metadata).
- [ ] Output includes **full `memberships` columns** for person members when rows exist in DB.
- [ ] No duplicate orchestration inlined in the route — shared core is single source of truth.

---

## 7) Traceability

| Epic Phase 4 item | This spec |
|-------------------|-----------|
| Chat route integration with updated tool guidance | §4, §6 |
| Access control parity | §2 Auth / space access |
