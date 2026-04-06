# Technical Specification — Chat AI integration for `get_people_by_space_slug`

## Document control

| Field                        | Value                                                                                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                   | Ready for implementation                                                                                                                                                                                                                        |
| **Epic**                     | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027)                                                                                                                                                  |
| **Depends on**               | MCP tool `get_people_by_space_slug` (see `mcp-get-people-by-space-slug-tech-spec.md`), shared core **`getSpaceMembersRoster`** (`packages/core/src/space/server/get-space-members-roster.ts`), and MCP package **`@hypha-platform/mcp-server`** |
| **Reference implementation** | `apps/web/src/app/api/chat/route.ts` — pattern for `get_space_by_slug` tool + `buildSystemPrompt`                                                                                                                                               |

---

## 1) Objective

Enable **Hypha AI** (OpenRouter / AI SDK `streamText` in the chat route) to answer questions such as:

- “Who are the members of this space?”
- “Which **other spaces** are members here?” (space-as-member rows — **not** child spaces in the hierarchy; see MCP spec §2.4)
- “When did `<person>` join?” (from **`memberships`** when present; else `join_source: unknown` in current core — see §2)
- “How many members are there?” (with optional follow-up pagination)

without hallucinating membership: the model MUST call a **server-side tool** backed by the **same roster semantics** as the MCP tool, **`getSpaceMembersRoster`**, and the Members tab API.

**Clarification:** The roster is **members of the active space** — **people** and **other spaces whose on-chain address appears in the host space’s member list** — **not** “everyone who belongs to child spaces” and **not** using `parent_id` / subspace hierarchy as a stand-in for membership.

---

## 2) Parity with MCP, core, and product

| Concern                     | Approach                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single implementation**   | Call **`getSpaceMembersRoster`** from `@hypha-platform/core/server` with `{ db }` (`@hypha-platform/storage-postgres`). **Do not** duplicate SQL, contract reads, or roster merge logic in the chat route. This is the same entry point used by **`packages/mcp-server`** for `get_people_by_space_slug`.                                                                                          |
| **Roster semantics**        | Matches MCP spec §2.1 / §3: on-chain **`getSpaceDetails`** member address list → resolve **people** (`people.address`) and **spaces** (`spaces.web3_address`, not archived) → attach **`memberships`** rows for `(host_space_id, person_id)` for people.                                                                                                                                           |
| **Ordering**                | **Merged list follows on-chain member address order** (implementation in `buildMemberEntriesFromAddresses`). Not a separate “people page” + “spaces page”; pagination is over this **single** merged list (MCP spec open question #1: **interleaved by chain order** — adopted).                                                                                                                   |
| **Membership fields**       | For each **person** member, **`membership`** is **`null`** if no DB row; otherwise **all `memberships` columns** in snake_case: `id`, `person_id`, `space_id`, `created_at`, `updated_at` (ISO-8601 strings in JSON/MCP output).                                                                                                                                                                   |
| **Join metadata (v1 core)** | **`join_source`**: for people, **`membership`** \| **`unknown`** (no `event` in current core). For space members: **`unknown`** only. **`joined_at`**: from `memberships.created_at` when `join_source === membership`; else `null`. Align chat tool return shape with MCP serialization.                                                                                                          |
| **Response envelope**       | Same as MCP structured payload: `found`, `space_slug`, `space` (`id`, `slug`, `title`, `parent_id`), **`source: "db"`**, **`source_chain: "rpc" \| null`** (null if chain read failed or no web3 space id), **`asOf`**, **`members`** (discriminated by `member_kind`: `person` \| `space`), **`pagination`** (`total`, `page`, `page_size`, `total_pages`, `has_next_page`, `has_previous_page`). |
| **Input**                   | Align with MCP §4.1: **`space_slug`**, **`page`** (default 1), **`page_size`** (default 20, max 100), optional **`searchTerm`** (filters merged list — same as core).                                                                                                                                                                                                                              |
| **Auth**                    | Chat already requires `Authorization: Bearer <Privy JWT>`. For parity with **`GET /api/v1/spaces/[spaceSlug]/members`**, consider invoking **`checkSpaceAccess`** when the host space has a `web3SpaceId` before calling `getSpaceMembersRoster` (same as members route). Document if chat intentionally stays broader.                                                                            |
| **Serialization**           | Core returns **`Date`** on nested `person` / `space` objects. MCP maps to ISO strings for **`structuredContent`**. The chat tool **`execute`** SHOULD return **JSON-serializable** objects for the model (ISO strings for all dates), matching MCP output.                                                                                                                                         |

---

## 3) Functional requirements

| ID        | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FR-C1** | The chat route SHALL register a tool **`get_people_by_space_slug`** (snake_case key in `tools` map, consistent with `get_space_by_slug`).                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **FR-C2** | The tool’s `inputSchema` SHALL accept **`space_slug`**, **`page`**, **`page_size`**, and optional **`searchTerm`**, consistent with MCP §4.1 and `GetSpaceMembersRosterInput`.                                                                                                                                                                                                                                                                                                                                                                              |
| **FR-C3** | When `spaceSlug` is present in the chat request body, the system prompt SHOULD instruct the model to **prefer** that slug for space-scoped membership questions without asking the user to repeat it.                                                                                                                                                                                                                                                                                                                                                       |
| **FR-C4** | The tool description SHALL state: read-only; returns **people and space-as-members** for the **active** space (Members tab / MCP parity); includes **full `memberships` snake_case object** for people when stored in DB; **`source`** / **`source_chain`** / **`asOf`** for transparency; supports pagination and optional search; use for **roster**, **which other spaces are in the member list**, **join timing** (DB-backed), and **who belongs**. **Do not** describe this as “nested spaces” in the hierarchy sense — that conflicts with MCP §2.4. |
| **FR-C5** | Errors from the DB or RPC layer SHALL be returned as structured tool results (`found: false` and/or `error` string), not thrown into the model stream, **matching the error style of `get_space_by_slug`** in the same file.                                                                                                                                                                                                                                                                                                                                |
| **FR-C6** | The tool SHALL NOT reimplement roster logic; it SHALL delegate to **`getSpaceMembersRoster`**.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

---

## 4) Implementation steps (`apps/web/src/app/api/chat/route.ts`)

1. **Import** `getSpaceMembersRoster` from `@hypha-platform/core/server` and `db` from `@hypha-platform/storage-postgres`.

2. **Define** `getPeopleBySpaceSlugTool` (AI SDK `tool()` or compatible object):

   - `description`: same intent as MCP registration string — triggers: “members”, “roster”, “who is in”, “spaces that are members” (meaning **space-as-member addresses**, not child subspaces).
   - `inputSchema`: Zod object aligned with §2 (`space_slug`, `page`, `page_size`, `searchTerm` optional).

3. **`execute`**:

   - Optionally enforce slug with **`sanitizeSlug`** (same regex as today) and map `space_slug` / `page` / `page_size` / `searchTerm` into `getSpaceMembersRoster({ spaceSlug, page, pageSize, searchTerm }, { db })`.
   - Optionally wrap with **`checkSpaceAccess`** when mirroring members API access control (see §2).
   - Map result to **LLM-safe JSON**: if needed, convert any remaining **`Date`** fields on nested `person` / `space` to **`.toISOString()`** so the payload matches MCP **`structuredContent`** (mirror `packages/mcp-server` serialization logic or extract a small shared formatter in core later).

4. **Register** in `streamText({ tools: { … } })`:

   ```typescript
   tools: {
     get_space_by_slug: getSpaceBySlugTool,
     get_people_by_space_slug: getPeopleBySpaceSlugTool,
   },
   ```

5. **`buildSystemPrompt`** — when `spaceSlug` is set, add guidance consistent with MCP naming:

   > For questions about **who belongs to this space**, **people members**, or **other spaces listed as members** (not child spaces in the tree), use **`get_people_by_space_slug`** with **`space_slug`** set to the slug above. Use **`get_space_by_slug`** for high-level space metadata and aggregate counts.

6. **`stopWhen` / step budget** — if membership queries need another page, the model should pass **`page`**; consider **`stepCountIs(n)`** ≥ 5 if multi-step listing is common (current default in route may still be 5).

---

## 5) Testing

| Test                 | Expected                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Manual / integration | Authenticated POST to `/api/chat` with `spaceSlug` set asks “list members and any spaces that are members”; model invokes `get_people_by_space_slug` with correct slug; response includes `source_chain` / `membership` objects when applicable. |
| Unit (optional)      | Mock `getSpaceMembersRoster`: tool returns deterministic JSON; Zod `inputSchema` accepts parameters.                                                                                                                                             |

E2E: add a Playwright or API test only if the repo already tests `/api/chat` tools; otherwise document manual QA steps for the first release.

---

## 6) Acceptance criteria

- [ ] New tool appears in the `tools` object and is invokable by the model for membership prompts.
- [ ] System prompt distinguishes **`get_people_by_space_slug`** (full roster: people + space-as-members, chain order, memberships rows) vs **`get_space_by_slug`** (metadata / counts).
- [ ] Output includes **`source`**, **`source_chain`**, **`asOf`**, and **`membership`** snake_case fields for person members when rows exist in DB.
- [ ] No duplicate orchestration inlined in the route — **`getSpaceMembersRoster`** is the single source of truth (same as MCP).

---

## 7) Traceability

| MCP spec section               | This doc                            |
| ------------------------------ | ----------------------------------- |
| §2 Data model & §3 FRs         | §2 Parity table                     |
| §4.1 Input                     | §2 Input, §3 FR-C2                  |
| §4.2 Output / join_source      | §2 Response envelope, join metadata |
| §5 Implementation (core + MCP) | §4 steps, `getSpaceMembersRoster`   |

| Epic Phase 4 item                                 | This spec |
| ------------------------------------------------- | --------- |
| Chat route integration with updated tool guidance | §4, §6    |
| Access control parity                             | §2 Auth   |
