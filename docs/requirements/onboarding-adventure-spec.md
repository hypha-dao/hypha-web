# Onboarding Adventure Specification (Product + UX + QA)

## Document control

| Field | Value |
| --- | --- |
| Status | Ready for implementation |
| Scope | Replace post-signup profile landing with a localized onboarding decision experience for new users. |
| Primary goal | Increase early activation by guiding users into one of four meaningful next actions immediately after profile creation. |
| Non-goals | Auth provider changes, wallet creation logic changes, full-page AI onboarding experience, custody/on-ramp integrations beyond external links. |
| Owner | Product + UX + Web Platform |
| Version | 1.0 |
| Last updated | 2026-05-10 |

---

## 1) Objective

Replace the post-signup "empty profile landing" with an engaging onboarding decision page that is playful, clear, and action-oriented, while preserving account creation reliability and existing route accessibility.

---

## 2) Scope boundaries

### 2.1 In scope

- New full-page onboarding shown immediately after successful profile creation.
- Four choice cards:
  - Explore the Network
  - Create your Space
  - Join a Space (space selector)
  - Deposit Funds in a Space (space selector)
- Navigation behavior and validation for all cards.
- Deposit details state (treasury address + QR + external links).
- Regression protections for account/profile creation and existing route accessibility.

### 2.2 Out of scope (phase 1)

- Full-page AI prompt/field experience (future phase only).
- Authentication provider behavior or wallet creation logic changes.
- Financial custody/on-ramp integrations beyond opening configured external links.

---

## 3) Information architecture and flow

### 3.1 Baseline (current behavior)

- New user completes signup/profile and is routed to profile route.
- If profile slug exists, routing resolves to slugged profile view.

### 3.2 Target behavior

1. User signs up and completes profile creation.
2. On success, user is routed to localized onboarding page.
3. User chooses one of four cards:
   - Explore the Network -> localized network page.
   - Create your Space -> localized create-space flow.
   - Join a Space -> user selects space -> selected space page.
   - Deposit Funds in a Space -> user selects space -> deposit details state.

### 3.3 Route intent (spec-level)

- Onboarding route: `/{lang}/onboarding` (final slug confirmable via open question OQ-1).
- Locale SHALL be preserved in all transitions.
- Returning users SHALL not be forced into onboarding unless explicitly gated by feature flag.
- Onboarding render failure SHALL fall back to existing profile destination.

---

## 4) UX and UI specification

### 4.1 Page layout

- Hero title with visual prominence comparable to existing "My Spaces" heading scale.
- Single-line supporting text: "Choose your next step" (localized).
- Four-card responsive grid:
  - Desktop/tablet: 2x2.
  - Mobile: single column stack.

### 4.2 Card design system and interaction rules

- Use existing tokens/components from `packages/ui` and `packages/ui-utils`.
- No ad-hoc color/spacing/radius values outside design system tokens.
- Card interaction states required:
  - Default
  - Hover
  - Active/pressed
  - Focus-visible (keyboard)
  - Disabled (selector-dependent cards)
- Minimum interactive target: 44x44 px.

### 4.3 Card content and behavior

#### Explore the Network

- Icon metaphor: discovery/network.
- Immediate navigation CTA (no intermediate selection).

#### Create your Space

- Icon metaphor: creation/plus/rocket.
- Immediate navigation CTA to create-space flow.

#### Join a Space

- Icon metaphor: handshake/group.
- Includes searchable selector (dropdown/autocomplete) over eligible spaces.
- Primary CTA disabled until a valid space selection is made.
- Confirm action routes to selected space destination.

#### Deposit Funds in a Space

- Icon metaphor: wallet/coins.
- Includes searchable selector limited to spaces with valid treasury address.
- CTA disabled until a valid space selection is made.
- On confirm, transition to deposit details state.

### 4.4 Deposit details state

When a valid deposit-eligible space is selected, render:

- Selected space name.
- Treasury account address.
- Address copy action.
- QR code encoding treasury address.
- External quick links with icon + label:
  - Coinbase
  - Wirex
  - Kraken

External-link behavior:

- Open in new tab.
- Use safe attributes (`rel="noopener noreferrer"` at minimum).
- URLs must come from trusted configuration/constants only.

### 4.5 Future extension slot (non-blocking hook)

- Reserve a top-level optional container region for future AI onboarding content.
- Current four-card flow SHALL not depend on AI availability.

---

## 5) Functional requirements

**FR-1** The system SHALL route newly created profiles to the onboarding adventure page instead of the default profile landing page.

**FR-2** The system SHALL display exactly four onboarding choices, each with icon, title, and action behavior.

**FR-3** The system SHALL route "Explore the Network" to the localized network route.

**FR-4** The system SHALL route "Create your Space" to the localized create-space flow.

**FR-5** The system SHALL provide a searchable selector for "Join a Space" populated from available spaces.

**FR-6** The system SHALL route "Join a Space" to the selected space page after a valid selection.

**FR-7** The system SHALL provide a searchable selector for "Deposit Funds in a Space" limited to spaces with valid treasury address data.

**FR-8** The system SHALL display selected space treasury address, QR code, and exchange links (Coinbase/Wirex/Kraken) in the deposit flow.

**FR-9** The system SHALL preserve locale across all onboarding transitions.

**FR-10** The system SHALL allow users to leave onboarding and continue normal navigation at any time.

---

## 6) Parity and no-regression constraints (critical)

**PAR-1** The account creation API contract and payload validation SHALL remain unchanged.

**PAR-2** Wallet-address prerequisite for profile creation SHALL remain enforced.

**PAR-3** Profile creation success criteria SHALL remain unchanged (no additional required fields).

**PAR-4** Existing behavior for already-onboarded users SHALL remain unchanged unless a feature flag explicitly enables onboarding for them.

**PAR-5** Existing profile route accessibility and deep links SHALL continue to work.

**PAR-6** Failure in onboarding route rendering SHALL fail safely to existing profile destination.

**PAR-7** Existing create-space, network, and space-page routes SHALL remain directly reachable outside onboarding.

---

## 7) Non-functional requirements

**NFR-1 (Accessibility)** The onboarding and deposit states SHALL meet WCAG 2.1 AA for keyboard traversal, focus visibility, form controls, and semantic links.

**NFR-2 (Performance)** Onboarding page SHALL become interactive within current post-signup baseline budgets, with no significant regression to post-signup TTI.

**NFR-3 (Resilience)** If spaces fetch fails, selector-dependent cards SHALL show recoverable error/empty states while non-selector cards remain usable.

**NFR-4 (Observability)** The system SHALL emit analytics events for onboarding card impressions and selections for funnel analysis.

**NFR-5 (Security)** External links SHALL use safe navigation attributes and SHALL NOT accept untrusted URL injection.

---

## 8) Acceptance criteria (Given/When/Then)

**AC-1** Given a new user successfully creates a profile,  
When profile creation completes,  
Then the user lands on the onboarding adventure page.

**AC-2** Given onboarding is visible,  
When the user clicks "Explore the Network",  
Then the user lands on the localized network page.

**AC-3** Given onboarding is visible,  
When the user clicks "Create your Space",  
Then the user lands on the localized create-space form.

**AC-4** Given onboarding is visible,  
When the user selects a space under "Join a Space" and confirms,  
Then the user lands on the selected space page.

**AC-5** Given onboarding is visible,  
When the user selects a space under "Deposit Funds in a Space",  
Then treasury QR and treasury address are shown for that selected space.

**AC-6** Given deposit details are shown,  
When the user clicks Coinbase/Wirex/Kraken links,  
Then each link opens in a new tab to its configured URL.

**AC-7** Given spaces fetch fails for selectors,  
When onboarding renders,  
Then non-selector cards remain usable and selector cards show recoverable empty/error state.

**AC-8** Given existing account creation flow,  
When signup/profile creation is executed,  
Then no regression occurs in success rate, validation, or auth continuity.

---

## 9) QA and test engineering plan

### 9.1 Test layers

| Layer | Scope |
| --- | --- |
| E2E (primary) | New-user signup -> profile creation -> onboarding landing; all 4 card journeys; selector enable/disable logic; locale continuity across transitions. |
| Integration | Space selector mapping/filtering (join list vs deposit-eligible list), onboarding redirection gating logic, onboarding failure fallback logic. |
| Accessibility | Keyboard-only traversal, focus order, focus-visible checks, semantic role assertions, axe scan on onboarding and deposit state. |
| Visual regression | Desktop + mobile snapshots for onboarding page and deposit details panel. |

### 9.2 Must-pass regression suite

- Signup + profile creation baseline path.
- Existing direct navigation to profile/my-spaces/network.
- Existing create-space flow remains reachable and successful.
- Existing space page routing/rendering remains unaffected.

### 9.3 Suggested event instrumentation contract

- `onboarding_adventure_impression`
  - props: `locale`, `user_id_hash`, `is_new_profile`, `flag_variant`
- `onboarding_adventure_card_selected`
  - props: `locale`, `card_id`, `has_space_selected`, `selected_space_slug?`
- `onboarding_adventure_deposit_link_clicked`
  - props: `locale`, `provider`, `space_slug`

---

## 10) Implementation decomposition (ticket breakdown)

### Epic: ONB-ADV-01 — Onboarding Adventure after profile creation

| Ticket | Title | Scope | Maps to | Dependency |
| --- | --- | --- | --- | --- |
| ONB-1 | Route and gating orchestration | Route new profiles to onboarding; preserve locale; add feature-flag gate for returning users; fallback to profile on onboarding render failure. | FR-1, FR-9, PAR-4, PAR-6 | None |
| ONB-2 | Onboarding page shell + 4-card layout | Build full-page layout, hero/subheading, responsive card grid, token-compliant interaction states. | FR-2, NFR-1, NFR-2 | ONB-1 |
| ONB-3 | Immediate-action cards navigation | Wire Explore + Create cards to localized routes; maintain direct route compatibility. | FR-3, FR-4, PAR-7 | ONB-2 |
| ONB-4 | Shared spaces selector data layer | Add spaces query + loading/error states + search filtering + locale-safe labels. | FR-5, FR-7, NFR-3 | ONB-2 |
| ONB-5 | Join a Space action card | Build selector UX + disabled/enabled CTA + navigation to selected space destination. | FR-5, FR-6, AC-4 | ONB-4 |
| ONB-6 | Deposit Funds flow and details state | Build deposit selector + treasury address display + copy action + QR generation + external links. | FR-7, FR-8, NFR-5, AC-5, AC-6 | ONB-4 |
| ONB-7 | Observability + analytics hooks | Emit impression/selection/link-click events with typed payloads and coverage tests. | NFR-4 | ONB-2, ONB-5, ONB-6 |
| ONB-8 | QA automation + regression hardening | Add Playwright coverage, accessibility checks, visual snapshots, and regression assertions for signup/profile baselines. | AC-1..AC-8, PAR-1..PAR-7 | ONB-1..ONB-7 |

---

## 11) Open product decisions

| ID | Decision needed | Owner | Default assumption |
| --- | --- | --- | --- |
| OQ-1 | Final onboarding route slug (`/onboarding` vs `/welcome`) | Product | Use `/onboarding` |
| OQ-2 | Canonical join destination for selected space (overview vs agreements vs home) | Product + UX | Use space default overview/agreements target already used by existing navigation |
| OQ-3 | Canonical external URLs for Coinbase/Wirex/Kraken | Product + Compliance | Read from configuration constants owned by product/compliance |
| OQ-4 | Onboarding experience policy (one-time, skippable, re-entry path) | Product | One-time for new profiles; skippable via normal navigation; returning users gated by flag |

---

## 12) Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Spaces fetch instability degrades selector cards | Medium | Degrade gracefully: keep non-selector cards active, show retry/empty state for selector cards (NFR-3). |
| Locale dropped during redirects | High | Centralize localized route builders and add integration tests for locale propagation (FR-9, AC-2..AC-4). |
| Regression in signup/profile success handoff | High | Preserve API/payload contracts; enforce parity tests in ONB-8 (PAR-1..PAR-3, AC-8). |
| External link misconfiguration/security drift | Medium | Use trusted constants only, validate URL allowlist, add tests for target + rel attributes (NFR-5). |

---

## 13) References

- Existing vault examples:
  - `docs/requirements/Features/group-chat-reply/requirements.md`
  - `docs/requirements/dho-home-token-holdings-dashboard-spec.md`

---

## 14) Revision history

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0 | 2026-05-10 | Requirements + UX + QA (agent) | Initial ready-to-implement onboarding adventure spec with FR/PAR/NFR, ACs, QA plan, and ticket decomposition. |
