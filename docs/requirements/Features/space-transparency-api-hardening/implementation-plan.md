# Implementation plan — Space transparency API & interaction hardening

## Document control

| Field | Value |
|-------|--------|
| **Status** | Ready to implement |
| **Requirements** | [requirements.md](./requirements.md) |
| **Estimated PRs** | 2–3 (Phase 1+2 shippable together; Phase 3–4 optional follow-ups) |
| **Base branch** | `main` (after merging PR #2325 or cherry-picking S-I helpers) |

---

## 0) Pre-merge checklist

Before starting Phase 1:

1. Merge [PR #2325](https://github.com/hypha-dao/hypha-web/pull/2325) **or** cherry-pick:
   - `packages/core/src/space/server/authorize-space-panel-interaction.ts`
   - `packages/core/src/space/server/is-on-chain-member-or-delegate.ts` (if not already on main)
   - `apps/web/src/app/api/chat/route.ts` — **S-I** block
   - `packages/epics/src/spaces/utils/transparency-access.ts` — `canInteractInSpace`
2. Confirm `checkSpaceAccessForSpace` org-sibling logic matches `apps/web/src/utils/check-space-access.ts` (they should already mirror).

---

## Phase 1 — Consolidate evaluator + close read bypasses

**Goal:** Single source of truth; gate metadata, org tree, and document-by-slug.

### 1.1 Deduplicate server access helper

| Step | File | Action |
|------|------|--------|
| 1 | `packages/core/src/space/server/check-space-access-for-roster.ts` | Keep as canonical `checkSpaceAccessForSpace` |
| 2 | `packages/core/src/space/server/check-space-access-for-request.ts` | **New** — thin wrapper: `(request: NextRequest, web3SpaceId) => CheckSpaceAccessResult` extracting Bearer token + calling `checkSpaceAccessForSpace` after resolving space by slug |
| 3 | `apps/web/src/utils/check-space-access.ts` | Replace body with re-export / delegate to core wrapper (preserve export name for existing imports) |
| 4 | `packages/core/src/space/server/index.ts` | Export new helpers |

**Suggested wrapper signature:**

```typescript
// packages/core/src/space/server/check-space-access-for-request.ts
export async function checkSpaceAccessFromRequest(
  request: Request | NextRequest,
  web3SpaceId: number | bigint,
): Promise<CheckSpaceAccessForRosterResult & { userAddress?: `0x${string}`; authToken?: string }>;
```

Map `httpStatus` → `NextResponse` in apps/web only.

### 1.2 Gate space metadata route

| File | Change |
|------|--------|
| `apps/web/src/app/api/v1/spaces/[spaceSlug]/route.ts` | Load space; if `web3SpaceId` null → off-chain policy (membership row or 403); else call `checkSpaceAccessFromRequest`. Remove `TODO: implement authorization`. |

### 1.3 Gate organisation route

| File | Change |
|------|--------|
| `apps/web/src/app/api/v1/spaces/[spaceSlug]/organisation/route.ts` | Resolve host space → `checkSpaceAccessFromRequest` on host `web3SpaceId` before `getAllOrganizationSpacesForNodeById`. |

### 1.4 Gate document-by-slug route

| File | Change |
|------|--------|
| `apps/web/src/app/api/v1/documents/[documentSlug]/route.ts` | `findDocumentBySlug` → join/load host space → `checkSpaceAccessFromRequest` on space's `web3SpaceId`. Return 404 if document missing; 403 if denied. |

**Query addition (if needed):** extend `findDocumentBySlug` or add `findDocumentWithSpaceBySlug` in `packages/core/src/governance/server/queries.ts` to avoid N+1.

### 1.5 Tests (Phase 1)

| File | Coverage |
|------|----------|
| `packages/core/src/space/server/__tests__/check-space-access-for-roster.test.ts` | Extend org-sibling matrix cases (may exist partially) |
| `apps/web/src/utils/__tests__/check-space-access-routes.test.ts` | **New** — table-driven tests for metadata, organisation, documents routes (mock db + viem `readContract`) |

**Definition of done (Phase 1):** AC-1, AC-2, AC-3, AC-6 from requirements.md.

---

## Phase 2 — Mutation hardening (coherence + space update)

**Goal:** Server actions and profile update require **S-M**.

### 2.1 Shared member/delegate authorizer

Reuse `isOnChainMemberOrDelegate` + DB membership fallback (same as `authorizeSpacePanelInteraction`):

| File | Action |
|------|--------|
| `packages/core/src/space/server/authorize-space-mutation.ts` | **New** — alias or thin wrapper around same logic as `authorizeSpacePanelInteraction`; export `authorizeSpaceMutation({ spaceSlug, authToken })` |

### 2.2 Coherence server actions

| File | Change |
|------|--------|
| `packages/core/src/coherence/server/actions.ts` | Before each mutation: resolve space from input → `authorizeSpaceMutation`. Use `getDb({ authToken })` consistently (fix `updateCoherenceBySlugAction` global `db` usage). |
| `packages/core/src/coherence/server/mutations.ts` | Keep creator/membership checks for edit/delete; add `createCoherence` guard: verify `creatorId` is requester and requester is **S-M** on `spaceId`. |

### 2.3 Space profile update

| File | Change |
|------|--------|
| `apps/web/src/app/api/v1/spaces/[spaceSlug]/update/route.ts` | After auth token validation → `authorizeSpaceMutation` → proceed with `updateSpaceBySlug`. |

### 2.4 Tests (Phase 2)

| File | Coverage |
|------|----------|
| `packages/core/src/coherence/server/__tests__/actions-auth.test.ts` | **New** — non-member create/update rejected |
| `packages/core/src/space/server/__tests__/authorize-space-mutation.test.ts` | **New** — member/delegate/org-member-not-target cases |

**Definition of done (Phase 2):** AC-4, AC-5 (if #2325 merged), space update blocked for non-members.

---

## Phase 3 — Human chat interaction (Matrix)

**Goal:** **S-I** parity for human chat writes (optional separate PR).

### Option A (recommended v1) — Matrix power levels on join

When a user obtains Matrix token / joins space room:

| File | Change |
|------|--------|
| `apps/web/src/app/api/matrix/token/route.ts` or join helper | After Privy auth, if user fails **S-I**, issue token but set Matrix user power level 0 and `m.room.message` send level > 0; if passes **S-I**, set power level allowing send. |
| Document | Runbook for homeserver admin if power-level API requires elevated token |

### Option B — Hypha send proxy

| File | Change |
|------|--------|
| `apps/web/src/app/api/matrix/send/route.ts` | **New** — `authorizeSpacePanelInteraction` → forward to homeserver with service account |

**Recommendation:** Option A avoids per-message latency; Option B gives strongest audit trail. Spike 1–2 days before implementing.

**Definition of done (Phase 3):** Non-member with Matrix token cannot post messages in space room (manual QA + integration test if homeserver available in CI).

---

## Phase 4 — Discoverability on list API (optional)

**Goal:** **FR-9** — server-side D filter.

| File | Change |
|------|--------|
| `apps/web/src/app/api/v1/spaces/route.ts` | Accept optional auth; for each space batch-read `getSpaceVisibility`; filter with shared `checkDiscoverability(level, userState)` where `userState` derived from token + on-chain membership batch (performance: cache visibility per request). |
| `packages/core/src/space/server/filter-spaces-by-discoverability.ts` | **New** — pure function + batched viem reads |

**Performance note:** May require pagination changes; consider filtering only for `parentOnly` explore endpoints first.

---

## File touchpoint summary

```
packages/core/src/space/server/
  check-space-access-for-roster.ts          (keep canonical)
  check-space-access-for-request.ts       (new)
  authorize-space-mutation.ts             (new, or reuse panel interaction)
  authorize-space-panel-interaction.ts    (from #2325)
  is-on-chain-member-or-delegate.ts         (existing)
  filter-spaces-by-discoverability.ts     (Phase 4)
  index.ts                                  (exports)

apps/web/src/utils/check-space-access.ts  (delegate to core)

apps/web/src/app/api/v1/spaces/[spaceSlug]/
  route.ts                                  (Phase 1)
  organisation/route.ts                     (Phase 1)
  update/route.ts                           (Phase 2)

apps/web/src/app/api/v1/documents/[documentSlug]/
  route.ts                                  (Phase 1)

packages/core/src/coherence/server/
  actions.ts                                (Phase 2)
  mutations.ts                              (Phase 2)

apps/web/src/app/api/chat/route.ts          (S-I from #2325)
```

---

## Implementation order (suggested commits)

1. `refactor(core): dedupe checkSpaceAccess into core package`
2. `fix(api): gate space metadata, organisation, and document-by-slug routes`
3. `test(core): expand transparency matrix access fixtures`
4. `fix(coherence): require space membership for signal mutations`
5. `fix(api): require membership for space profile update`
6. `(optional) fix(matrix): align room send power levels with membership`
7. `(optional) feat(api): filter spaces list by discoverability`

---

## Rollout & compatibility

- **Breaking for attackers only** — legitimate clients already send Bearer tokens on gated routes.
- **Ecosystem navigation** may start failing for users who relied on ungated `/organisation` while lacking **A**; this is intended.
- **Mobile / MCP clients** must send `Authorization: Bearer` on newly gated routes (already required for members/coherences).

---

## Open decisions (defaults if no product input)

| # | Question | Default |
|---|----------|---------|
| OD-1 | Public space metadata for anonymous `GET /spaces/{slug}` | Require **S-A**; public level allows anonymous 200 |
| OD-2 | Banking tab visible to org viewers | Keep UI-A; APIs stay **S-M** (no change) |
| OD-3 | Matrix Phase 3 in same PR vs follow-up | **Follow-up PR** after Phase 1+2 |

---

## Verification commands

```bash
# Unit tests
pnpm --filter @hypha-platform/core exec vitest run src/space/server/__tests__/
pnpm --filter @hypha-platform/core exec vitest run src/coherence/server/__tests__/

# Typecheck
pnpm --filter web exec tsc --noEmit

# Lint
pnpm lint
```

Manual: run QA checklist in [requirements.md §10](./requirements.md#10-qa-checklist-manual).
