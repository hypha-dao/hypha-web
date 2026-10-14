# Space transparency matrix — API & interaction hardening

## Document control

| Field | Value |
|-------|--------|
| **Status** | Ready for implementation |
| **Related spec** | [Organisation visibility & activity access](../space-transparency-matrix-organisation-visibility/requirements.md) (matrix semantics, org CTA parity — largely addressed in PR [#2325](https://github.com/hypha-dao/hypha-web/pull/2325)) |
| **Scope** | Close server-side gaps where protected space data or mutations can bypass UI gates; align **interaction** (chat/AI write) with **mutation** (proposals/settings) boundaries |
| **Out of scope** | Redesigning transparency settings UI; replacing Matrix with a custom chat backend |

---

## 1) Problem statement

The transparency matrix defines who may **discover** a space (D), **view activity** (A), and (separately) **interact or mutate** (I/M). Client helpers in `packages/epics/src/spaces/utils/transparency-access.ts` and server helpers in `apps/web/src/utils/check-space-access.ts` / `packages/core/src/space/server/check-space-access-for-roster.ts` enforce **A** on most tab data APIs.

A security review (June 2026) found **residual bypass paths**:

1. **Metadata enumeration** — `GET /api/v1/spaces/{slug}` and `GET …/organisation` return data without transparency checks.
2. **Document-by-slug leak** — `GET /api/v1/documents/{slug}` has no space access gate.
3. **Coherence mutations** — server actions accept auth tokens but do not consistently require target-space membership or activity access.
4. **Human chat writes** — Matrix SDK sends go directly to the homeserver; UI locks are not mirrored server-side per message.
5. **Discoverability on list APIs** — `GET /api/v1/spaces` is not filtered by on-chain discoverability level.
6. **Space profile update** — `POST …/update` requires auth but not role/membership.

Activity-protected tab content (documents, treasury, members, coherences, org-memory, overview dashboards) is **already server-gated** via `checkSpaceAccess`. This ticket closes the remaining holes and documents the full tab→API→gate map as the canonical reference.

---

## 2) Definitions

| Term | Meaning |
|------|---------|
| **D (Discoverability)** | Space appears in network/explore lists and navigation |
| **A (Activity access)** | User may view protected tab content and call space-scoped read APIs |
| **I (Interaction)** | User may send AI prompts or human chat messages in a space context |
| **M (Mutation)** | User may create proposals, subspaces, signals, settings changes, treasury actions |
| **S-A** | Server enforcement of **A** via `checkSpaceAccess` / `checkSpaceAccessForSpace` |
| **S-I** | Server enforcement of **I** via `authorizeSpacePanelInteraction` (member/delegate of target space) |
| **S-M** | Server enforcement of **M** — member/delegate of target space and/or on-chain governance |

**Normative rule:** **S-A** is the authority for read APIs. **S-I** and **S-M** are **stricter** than **A** (org members may **view** but not **write**).

---

## 3) Baseline transparency matrix (normative)

| User state ↓ \ Level → | Public | Network | Organisation | Space |
|------------------------|:------:|:-------:|:------------:|:-----:|
| Not logged in | D ✓ / A ✓ | D ✗ / A ✗ | D ✗ / A ✗ | D ✗ / A ✗ |
| Logged in (non-member) | D ✓ / A ✓ | D ✓ / A ✓ | D ✗ / A ✗ | D ✗ / A ✗ |
| Org member (sibling space) | D ✓ / A ✓ | D ✓ / A ✓ | D ✓ / A ✓ | D ✗ / A ✗ |
| Target-space member/delegate | D ✓ / A ✓ | D ✓ / A ✓ | D ✓ / A ✓ | D ✓ / A ✓ |

**Interaction & mutation (all transparency levels):**

| Capability | Who |
|------------|-----|
| **I** — AI chat, human chat composer | Target-space member/delegate only |
| **M** — Create proposal, signal, subspace, space settings | Target-space member/delegate only (+ on-chain for governance) |
| **Banking APIs** | Target-space member/delegate only (`authorizeSpaceBankOnboarding`) — stricter than **A** |

---

## 4) DHO tab → API → gate map (canonical)

**UI-A** = `SpaceTabAccessWrapper` + `checkAccess()`. **S-A** = `checkSpaceAccess*`. **S-M** / **S-I** as defined above.

| Tab | Primary read APIs | Server read gate | Write / interact | Server write gate |
|-----|-------------------|------------------|------------------|-------------------|
| **Overview** | `…/overview-activity`, `…/token-holdings`, `…/token-distribution-history` | **S-A** | — | — |
| **Ecosystem navigation** | `…/organisation`, `…/spaces/{slug}` | **None today** → **S-A (Phase 1)** | Add subspace | **S-M** + on-chain |
| **Signals (Coherence)** | `…/coherences`, `/api/v1/signals/{slug}` | **S-A** | Create/edit/delete signal | **S-M** (Phase 2) |
| **Agreements** | `…/documents`, `…/documents/all`, `/api/v1/documents/{slug}` | **S-A** on space routes; **None on document slug** → **S-A (Phase 1)** | Create proposal | **S-M** + **Chain** |
| **Members** | `…/members` | **S-A** | — | — |
| **Treasury** | `…/assets`, `…/transfers`, `…/vaults`, etc. | **S-A** | Deposit, new token | **S-M** + **Chain** |
| **Banking** | `…/banking/*` | **S-M** (`authorizeSpaceBankOnboarding`) | Transfers, KYC | **S-M** |
| **Rewards** | `…/assets` + on-chain RPC | **S-A** on assets; chain public | Claim | **S-M** + **Chain** |
| **Memory** | `…/org-memory` | **S-A** | New memory | **S-M** |
| **AI panel** | (tools use tab APIs above) | Inherited **S-A** | `POST /api/chat` | **S-I** (PR #2325) |
| **Human chat** | Matrix sync | Matrix room membership | Matrix `sendMessage` | **None today** → Phase 3 |

### Supporting routes

| Route | Today | Target |
|-------|-------|--------|
| `GET /api/v1/spaces` | No D filter | **Phase 4:** filter by discoverability |
| `GET /api/v1/spaces/{slug}` | No gate | **Phase 1:** **S-A** (or public-metadata subset) |
| `GET /api/v1/spaces/{slug}/organisation` | No gate | **Phase 1:** **S-A** on host space |
| `GET /api/v1/documents/{slug}` | No gate | **Phase 1:** **S-A** via document's space |
| `POST /api/v1/spaces/{slug}/update` | Auth only | **Phase 2:** **S-M** |
| Coherence server actions | Partial auth | **Phase 2:** **S-A** + **S-M** |

---

## 5) Gap analysis & priority

| ID | Gap | Risk | Phase |
|----|-----|------|-------|
| **G-1** | Ungated space metadata + org tree | Slug enumeration leaks titles, hierarchy | 1 |
| **G-2** | Ungated document-by-slug | Bypass agreements tab | 1 |
| **G-3** | Coherence create/update without membership | Authenticated non-member mutates signals | 2 |
| **G-4** | Space `update` without role check | Profile tampering | 2 |
| **G-5** | Matrix send without Hypha gate | UI bypass for chat | 3 |
| **G-6** | List API without discoverability filter | D matrix not enforced server-side | 4 |
| **G-7** | Duplicate `checkSpaceAccess` implementations | Drift between web app and core | 1 |

---

## 6) Functional requirements

**FR-1** All space-scoped **read** APIs that return activity-protected data SHALL call a single shared access evaluator equivalent to `checkSpaceAccessForSpace` before returning 200.

**FR-2** `GET /api/v1/spaces/{slug}` SHALL either (a) require **S-A** for the full payload, or (b) return a **public metadata subset** when activity level is Public and caller is unauthenticated — document the chosen behavior in the implementation plan (default: **full S-A** for simplicity).

**FR-3** `GET /api/v1/spaces/{slug}/organisation` SHALL require **S-A** on the host space before returning sibling space records.

**FR-4** `GET /api/v1/documents/{slug}` SHALL resolve the document's host space, require **S-A** on that space's `web3SpaceId`, and return 403/401 consistent with other routes.

**FR-5** Coherence **create**, **update**, and **delete** server actions SHALL require **S-M** (target-space member/delegate). **Read** paths remain **S-A**.

**FR-6** `POST /api/v1/spaces/{slug}/update` SHALL require **S-M**.

**FR-7** `POST /api/chat` with a `spaceSlug` SHALL require **S-I** (`authorizeSpacePanelInteraction`) — merge from PR #2325 if not on `main`.

**FR-8** Human chat **Phase 3** SHALL document and implement one of: (a) Matrix power levels aligned with on-chain membership on join, or (b) a Hypha-proxied send endpoint that enforces **S-I** before forwarding to Matrix.

**FR-9** `GET /api/v1/spaces` **Phase 4** SHALL filter results using on-chain discoverability + caller identity (same semantics as `checkDiscoverability`).

**FR-10** Banking routes SHALL continue to use **S-M** only; optionally hide Banking tab unless `LOGGED_IN_SPACE` (UX follow-up, not blocking).

---

## 7) Non-functional requirements

**NFR-1** Access denial responses SHALL use existing shapes: 401 unauthenticated, 403 not eligible, 500 evaluator failure.

**NFR-2** Shared evaluator logic SHALL live in `packages/core` (`checkSpaceAccessForSpace`); `apps/web/src/utils/check-space-access.ts` SHALL delegate to it (no duplicated org-sibling logic).

**NFR-3** Each new gate SHALL have unit tests with fixtures: anonymous, logged-in non-member, org sibling member, target member/delegate, for each transparency level 0–3.

**NFR-4** No regression to organisation-level **A** already implemented in `checkSpaceAccessForSpace` sibling checks.

---

## 8) Acceptance criteria

**AC-1** Unauthenticated caller requesting `GET …/spaces/{slug}` for Network+ activity space receives 401 (or public subset if FR-2 option b is chosen).

**AC-2** Org-eligible user requesting `GET …/organisation` for Organisation activity space receives 200; non-org user receives 403.

**AC-3** User without **A** requesting `GET /api/v1/documents/{slug}` receives 403 even if slug is known.

**AC-4** Authenticated org member (not target member) calling coherence create action receives error; target member succeeds.

**AC-5** Non-member calling `POST /api/chat` with `spaceSlug` receives forbidden response (after **S-I** merge).

**AC-6** Existing **S-A** routes (documents/all, assets, members, coherences, org-memory, overview-*) continue to pass org-sibling and member scenarios (regression suite green).

---

## 9) Dependencies

| Dependency | Notes |
|------------|-------|
| PR [#2325](https://github.com/hypha-dao/hypha-web/pull/2325) | Ships `authorizeSpacePanelInteraction`, `canInteractInSpace`, panel UI gates — **merge first** or cherry-pick **S-I** pieces into hardening PR |
| On-chain visibility | Source of truth for levels 0–3 via `getSpaceVisibility` |
| Matrix homeserver | Phase 3 may require Synapse/admin API or join-time power-level sync |

---

## 10) QA checklist (manual)

- [ ] Public space: anonymous can load overview/agreements data via API
- [ ] Network space: anonymous 401 on members API; logged-in non-member 200
- [ ] Organisation space: sibling org member 200 on documents/all; outsider 403
- [ ] Space level: only target member 200 on members API
- [ ] Document-by-slug: outsider 403 after Phase 1
- [ ] Org tree: outsider 403 on `/organisation` after Phase 1
- [ ] AI chat: non-member POST `/api/chat` rejected
- [ ] Coherence: non-member cannot create signal via UI **and** server action
