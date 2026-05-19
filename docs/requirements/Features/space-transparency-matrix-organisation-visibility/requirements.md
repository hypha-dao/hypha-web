# Space transparency matrix — organisation visibility & activity access

**Status:** Analysis complete (spec only, no implementation)  
**Traceability**

| Item | Value |
|------|--------|
| Reported bug | Users in the same organisation (member in one or more sibling spaces) do not reliably see **Request Invite / Become member** when target space transparency is organisation-scoped |
| Scope | Discoverability + space activity access behavior and transparency matrix parity across UI and API guards |
| Primary surfaces | Space tab access gates, access-denied CTA, network discoverability filters, server access helper |

**Note:** This document captures current-state analysis and requirement deltas only. It does **not** implement code changes.

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

**Non-goals**

- Implementing code fixes in this work item.
- Redesigning transparency settings UI copy (except where wording is required for unambiguous behavior).

---

## 3. Definitions

- **Discoverability:** Whether a user can see/list a space in network/explore listings and navigation surfaces.
- **Space activity access:** Whether a user can view protected space activity data (tabs/content guarded by transparency access checks).
- **Organisation member (for target space):** A user who is a member or valid delegate in at least one **sibling space** within the same organisation grouping as the target space.
- **Membership CTA:** The actionable control to enter the membership flow for a denied user (`Become member` for open join, `Request Invite` for invite-only).

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

## 6. Functional requirements

**FR-1** The system SHALL apply the transparency matrix in §4 uniformly across discoverability and activity access decisions for all space surfaces.

**FR-2** The system SHALL classify a user as organisation-eligible for a target space when the user is a member or valid delegate in at least one sibling space within the same organisation grouping.

**FR-3** The system SHALL grant activity access for `Organisation` activity level to users classified as organisation-eligible for the target space.

**FR-4** The system SHALL render a membership CTA in denied activity states for authenticated non-members whenever a join flow is available for the target space, even if DB `space.id` is temporarily unavailable but the target web3 identity is known.

**FR-5** The system SHALL choose CTA behavior by join method:
- invite-only -> show `Request Invite`
- open/token-eligible membership -> show `Become member` (or equivalent enabled membership action)

**FR-6** The system SHALL keep frontend and backend access outcomes consistent for organisation-level access checks (no frontend-allowed/backend-denied mismatch for equivalent identity/context).

**FR-7** The system SHALL preserve denial behavior for users outside organisation scope when activity level is `Organisation`.

---

## 7. Non-functional requirements

**NFR-1** Matrix decisions SHALL be deterministic and side-effect free for a given `(user identity, target space, visibility config)` input tuple.

**NFR-2** Authorisation and discoverability logic SHALL be traceable in tests with explicit fixtures for:
- unauthenticated user
- logged-in non-member
- sibling-space org member
- target-space member/delegate

**NFR-3** Regression coverage SHALL include both UI and server gates for organisation-level scenarios to prevent parity drift.

---

## 8. Acceptance criteria

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

---

## 9. QA strategy

### 9.1 Priority scenarios

1. **High:** Organisation member from sibling space accesses target activity (allow path).
2. **High:** Denied state still shows correct CTA for invite/open join methods.
3. **High:** Backend parity for organisation-level access.
4. **Medium:** Discoverability and activity consistency across tabs/lists.

### 9.2 Recommended automated coverage

- **E2E (Playwright):**
  - seed users across 3 states: outsider, sibling-org-member, target-member
  - verify discoverability listings and protected tab access per matrix
  - assert CTA presence/label in denied state
- **Integration/API:**
  - server `checkSpaceAccess` fixtures for `Organisation` access level with sibling-org membership true/false
- **Contract tests:**
  - shared matrix expectation table in tests consumed by frontend+backend checks

---

## 10. Open questions

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| OQ-1 | Is delegate-in-sibling-space sufficient for organisation eligibility in all product contexts, or only for activity access? | Product + Governance | Open |
| OQ-2 | Should denied CTA fallback support web3-only mode when DB `space.id` is unavailable, or should the view block until DB identity resolves? | Engineering | Open |

---

## 11. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-05-19 | Requirements + QA (agent) | Initial analysis spec for organisation visibility/transparency matrix gaps (no implementation). |
