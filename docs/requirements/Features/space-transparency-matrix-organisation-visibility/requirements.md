# Space transparency matrix — organisation visibility & activity access

**Status:** Ready for implementation  
**Traceability**

| Item | Value |
|------|--------|
| Reported bug | Users in the same organisation (member in one or more sibling spaces) do not reliably see **Request Invite / Become member** when target space transparency is organisation-scoped |
| Scope | Discoverability + space activity access behavior and transparency matrix parity across UI and API guards |
| Primary surfaces | Space tab access gates, access-denied CTA, network discoverability filters, server access helper |

**Delivery mode:** This specification is implementation-ready and includes execution steps, file-level scope, and QA gates.

---

## 1. Problem statement

The transparency matrix is the foundation for who can **discover** a space and who can **access space activity**. Current behavior shows gaps when visibility is set to **Organisation**:

- Some organisation members from sibling spaces are denied data paths that should be allowed.
- In denied-state UX, some users do not receive the expected membership CTA (`Request Invite` / `Become member`) even though they should be able to request or join.

This creates inconsistent behavior between matrix intent, UI affordances, and server-side authorization.

---

## 2. Goals and non-goals

**Goals**

- Specify canonical transparency matrix semantics for **discoverability** and **space activity access**.
- Identify and formalize current behavior gaps in organisation-level scenarios.
- Define testable acceptance criteria for UI and server parity.

**Non-goals (this increment)**

- Redesigning transparency settings UI copy (except where wording is required for unambiguous behavior).
- Refactoring unrelated space list, card, or governance flows beyond transparency access parity.

---

## 3. Definitions

- **Discoverability:** Whether a user can see/list a space in network/explore listings and navigation surfaces.
- **Space activity access:** Whether a user can view protected space activity data (tabs/content guarded by transparency access checks).
- **Organisation member (for target space):** A user who is a member or valid delegate in at least one **sibling space** within the same organisation grouping as the target space.
- **Membership CTA:** The actionable control to enter the membership flow for a denied user (`Become member` for open join, `Request Invite` for invite-only).
- **Proposal authoring permission:** Ability to create governance proposals in a space. This permission is stricter than organisation-level visibility/activity and requires target-space membership (or equivalent target-space governance entitlement).

---

## 4. Baseline transparency matrix (normative)

The system SHALL enforce a consistent matrix for each user state and transparency level:

| User state \ Level | Public | Network | Organisation | Space |
|---|---:|---:|---:|---:|
| Not logged in | D: Yes / A: Yes | D: No / A: No | D: No / A: No | D: No / A: No |
| Logged in (non-member) | D: Yes / A: Yes | D: Yes / A: Yes | D: No / A: No | D: No / A: No |
| Logged in, organisation member | D: Yes / A: Yes | D: Yes / A: Yes | D: Yes / A: Yes | D: No / A: No |
| Logged in, target-space member/delegate | D: Yes / A: Yes | D: Yes / A: Yes | D: Yes / A: Yes | D: Yes / A: Yes |

Legend: `D` = discoverability, `A` = activity access.

---

## 5. Analysis findings (current-state gaps)

### 5.1 Gap A — Membership CTA hidden in denied state

Current denied-state rendering requires both:

- target DB space id (`space.id`), and
- web3 space id (`effectiveSpaceId`)

before rendering `JoinSpace`. In organisation visibility scenarios, `effectiveSpaceId` can be present while `space.id` is unresolved in that render path, causing CTA suppression.

**Impact:** Users who should see `Request Invite` / `Become member` instead see only denial text with no action.

### 5.2 Gap B — Server-side organisation access parity mismatch

Server access helper currently validates:

- direct member/delegate of target space

but does not complete organisation-level sibling-membership evaluation before returning 403 for organisation access level.

**Impact:** Organisation members from other spaces can pass frontend matrix assumptions but fail backend data access, producing inconsistent UX and missing data.

### 5.3 Gap C — Cross-surface divergence risk

Discoverability filtering for network/explore includes dedicated organisation-group handling, while tab access and server checks rely on separate logic paths.

**Impact:** “Can discover” and “can open activity” may drift over time unless governed by shared requirements and parity tests.

---

## 6. Implementation decisions (locked for this release)

To make this spec execution-ready, the following defaults are fixed:

- **D-1 (Organisation eligibility):** Delegate-in-sibling-space counts as organisation eligibility, matching member/delegate semantics already used for target-space checks.
- **D-2 (CTA fallback):** If web3 space identity is known and DB `space.id` is unavailable, UI SHALL still render an actionable membership CTA using a web3-first join path.
- **D-3 (Parity source):** Server-side authorisation is the final authority for protected data access; frontend checks SHALL mirror, not redefine, server outcomes.
- **D-4 (No behavior broadening):** `Space` activity level remains strict target-space membership/delegate only.
- **D-5 (Proposal creation boundary):** Being a member of one or several sibling spaces in the same organisation does not grant proposal creation rights in the target space; target-space membership is still required.

---

## 7. Functional requirements

**FR-1** The system SHALL apply the transparency matrix in §4 uniformly across discoverability and activity access decisions for all space surfaces.

**FR-2** The system SHALL classify a user as organisation-eligible for a target space when the user is a member or valid delegate in at least one sibling space within the same organisation grouping.

**FR-3** The system SHALL grant activity access for `Organisation` activity level to users classified as organisation-eligible for the target space.

**FR-4** The system SHALL render a membership CTA in denied activity states for authenticated non-members whenever a join flow is available for the target space, even if DB `space.id` is temporarily unavailable but the target web3 identity is known.

**FR-5** The system SHALL choose CTA behavior by join method:
- invite-only -> show `Request Invite`
- open/token-eligible membership -> show `Become member` (or equivalent enabled membership action)

**FR-6** The system SHALL keep frontend and backend access outcomes consistent for organisation-level access checks (no frontend-allowed/backend-denied mismatch for equivalent identity/context).

**FR-7** The system SHALL preserve denial behavior for users outside organisation scope when activity level is `Organisation`.

**FR-8** The system SHALL require target-space membership (or equivalent target-space governance entitlement) for proposal creation, even when organisation-level activity visibility is granted.

**PAR-1** The system SHALL preserve existing governance boundary semantics: organisation-level membership broadens visibility/activity access only and SHALL NOT auto-grant target-space proposal authoring rights.

---

## 8. Non-functional requirements

**NFR-1** Matrix decisions SHALL be deterministic and side-effect free for a given `(user identity, target space, visibility config)` input tuple.

**NFR-2** Authorisation and discoverability logic SHALL be traceable in tests with explicit fixtures for:
- unauthenticated user
- logged-in non-member
- sibling-space org member
- target-space member/delegate

**NFR-3** Regression coverage SHALL include both UI and server gates for organisation-level scenarios to prevent parity drift.

---

## 9. Acceptance criteria

**AC-1** Given a user is logged in and is a member in a sibling space of the same organisation,  
When the target space activity level is `Organisation`,  
Then the user can open activity-protected tabs/content for that target space.

**AC-2** Given a logged-in user is denied activity access to a target space and is not yet target-space member,  
When the denied view is rendered and target web3 space identity is available,  
Then a membership CTA is visible and actionable.

**AC-3** Given a target space is invite-only,  
When the denied view displays membership CTA,  
Then the CTA label and behavior is `Request Invite`.

**AC-4** Given a target space is open/token-based membership,  
When the denied view displays membership CTA,  
Then the CTA label and behavior is `Become member` (or equivalent join action).

**AC-5** Given a user is not a member/delegate in target or sibling spaces,  
When target activity level is `Organisation`,  
Then activity access is denied.

**AC-6** Given equivalent user and target-space context,  
When access is checked in frontend and backend paths,  
Then both paths return consistent allow/deny decisions for organisation-level activity access.

**AC-7** Given discoverability level is `Organisation`,  
When an organisation-eligible user views network/explore surfaces,  
Then the target space appears in discoverability lists.

**AC-8** Given a user is member in one or several sibling spaces of the same organisation but not in the target space,  
When the user attempts to create a proposal in the target space,  
Then proposal creation is blocked until target-space membership is obtained.

**AC-9** Given the same user is denied proposal creation due to missing target-space membership,  
When the denied/join affordance is rendered,  
Then `Request Invite` or `Become member` is visible and actionable according to join method.

---

## 10. Implementation steps (phased)

### Phase 1 — Canonical access evaluator (shared domain logic)

**Objective:** Avoid drift by centralizing matrix evaluation semantics.

1. Create a shared evaluator module for organisation eligibility + matrix checks in a reusable package path.
2. Define explicit input contract:
   - user auth state
   - target-space membership/delegate flags
   - sibling-space membership/delegate flags
   - discoverability level
   - activity access level
3. Export pure functions for:
   - discoverability decision
   - activity access decision
   - denied-state CTA affordance (`canShowMembershipCta`, `ctaMode`)
4. Migrate existing frontend helper usage to the shared evaluator with parity assertions.

**Primary touchpoints**
- `packages/epics/src/spaces/utils/transparency-access.ts`
- `packages/epics/src/spaces/hooks/use-user-space-state.ts`
- (new shared evaluator module under `packages/core` or `packages/epics` domain utils)

### Phase 2 — Denied-state CTA reliability

**Objective:** Ensure denied users always receive an actionable membership path.

1. Update denied-state rendering so CTA does not hard-depend on DB `space.id` when web3 identity is known.
2. Ensure CTA mode maps correctly:
   - invite-only -> `Request Invite`
   - open/token -> `Become member`
3. Add safe loading/fallback handling to prevent silent CTA disappearance.

**Primary touchpoints**
- `packages/epics/src/spaces/components/space-access-denied.tsx`
- `packages/epics/src/spaces/components/join-space.tsx`

### Phase 3 — Server-side organisation parity

**Objective:** Align backend authorization with organisation-level matrix semantics.

1. Extend organisation access path to evaluate sibling-space eligibility before returning 403.
2. Keep response semantics explicit:
   - unauthenticated -> 401
   - authenticated but not org-eligible -> 403
3. Add structured logging fields for access decisions (reason code) for debugging parity issues.

**Primary touchpoints**
- `apps/web/src/utils/check-space-access.ts`

### Phase 4 — Surface parity validation

**Objective:** Confirm list discoverability and tab/activity access stay consistent.

1. Verify organisation filtering logic in network/explore remains aligned with shared evaluator.
2. Add contract tests to guarantee discoverability/access matrix consistency.

**Primary touchpoints**
- `packages/epics/src/spaces/hooks/use-spaces-discoverability-batch.ts`
- `packages/epics/src/spaces/components/space-tab-access-wrapper.tsx`

---

## 11. Implementation tickets (ready-to-execute)

### TICKET-1: Shared transparency evaluator

- **Scope:** Introduce pure matrix evaluator and migrate existing utility calls.
- **Dependencies:** none
- **Acceptance mapping:** FR-1, FR-2, FR-6, NFR-1
- **Done when:** frontend transparency decisions consume shared evaluator paths.

### TICKET-2: Denied-state membership CTA fix

- **Scope:** Remove fragile DB-id dependency for CTA visibility where web3 identity exists.
- **Dependencies:** TICKET-1 (recommended), but can proceed in parallel with adapter.
- **Acceptance mapping:** FR-4, FR-5, AC-2, AC-3, AC-4
- **Done when:** denied states consistently render actionable CTA for eligible non-members.

### TICKET-3: Backend organisation access parity

- **Scope:** Extend server helper to evaluate sibling-space organisation eligibility.
- **Dependencies:** TICKET-1 (or equivalent shared semantics)
- **Acceptance mapping:** FR-3, FR-6, FR-7, AC-1, AC-5, AC-6
- **Done when:** organisation-eligible users are allowed server-side, outsiders denied.

### TICKET-4: Regression tests (E2E + integration + contracts)

- **Scope:** Add matrix fixtures and parity assertions across frontend/backend.
- **Dependencies:** TICKET-2 and TICKET-3
- **Acceptance mapping:** AC-1..AC-7, NFR-2, NFR-3
- **Done when:** tests fail on parity drift and pass on fixed behavior.

---

## 12. QA strategy

### 9.1 Priority scenarios

1. **High:** Organisation member from sibling space accesses target activity (allow path).
2. **High:** Denied state still shows correct CTA for invite/open join methods.
3. **High:** Backend parity for organisation-level access.
4. **Medium:** Discoverability and activity consistency across tabs/lists.

### 12.2 Recommended automated coverage

- **E2E (Playwright):**
  - seed users across 3 states: outsider, sibling-org-member, target-member
  - verify discoverability listings and protected tab access per matrix
  - assert CTA presence/label in denied state
- **Integration/API:**
  - server `checkSpaceAccess` fixtures for `Organisation` access level with sibling-org membership true/false
- **Contract tests:**
  - shared matrix expectation table in tests consumed by frontend+backend checks

---

## 13. Release gates

- [ ] AC-1..AC-7 validated in CI.
- [ ] No frontend/backend parity mismatch in organisation scenarios.
- [ ] Denied-state CTA never disappears for authenticated non-members with known target web3 identity.
- [ ] Product sign-off on invite/open CTA wording and flow behavior.

---

## 14. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-19 | Requirements + Fullstack + QA (agent) | Promoted to ready-for-implementation spec with locked decisions, phased execution steps, ticket decomposition, and release gates. |
| 0.1 | 2026-05-19 | Requirements + QA (agent) | Initial analysis spec for organisation visibility/transparency matrix gaps (no implementation). |
