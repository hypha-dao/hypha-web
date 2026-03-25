# Profile menu dismissal (authenticated shell)

**Traceability**

| Item | Value |
|------|--------|
| GitHub issue | [hypha-web#1790](https://github.com/hypha-dao/hypha-web/issues/1790) |
| Title (issue) | Profile menu doesn't close anymore |
| Status | Implemented (pending QA sign-off) |

**Note:** The project requirements vault at `docs/requirements/` was introduced for this work item. When the Obsidian vault workflow is adopted, migrate this file into the canonical structure and link it from the main board.

---

## 1. Problem statement

The profile menu in the application chrome (triggered from the signed-in user control in the header or equivalent navigation) **remains open** when the user expects it to dismiss. This is a **regression** against expected overlay / popover behavior and blocks normal navigation and screen use.

**Stakeholder impact:** Any authenticated user who opens account/profile actions from the global menu.

---

## 2. Goals and non-goals

**Goals**

- Restore predictable open/close behavior for the profile menu consistent with platform and accessibility expectations.
- Ensure the menu can be dismissed without forcing a full-page reload.
- Define verifiable acceptance criteria and automated regression coverage where feasible.

**Non-goals**

- Redesigning profile menu content, copy, or visual styling (unless required to fix focus or dismissal bugs).
- Changing authentication or session semantics.

---

## 3. Definitions

- **Profile menu:** The dropdown, popover, or sheet that lists account-related actions (e.g. profile, settings, sign out) opened from the user avatar or account control in the global shell.
- **Dismiss:** The menu is fully closed (not visible, not intercepting pointer events, trigger returns to a sensible focus state).

---

## 4. User story

**As an** authenticated user,  
**I want** the profile menu to close when I finish my action or move on,  
**So that** I can use the rest of the app without the menu obscuring content or trapping interaction.

---

## 5. Functional requirements

**FR-1** The system SHALL close the profile menu when the user activates a **menu item** that navigates to another route or view (unless the product explicitly documents an exception for that item).

**FR-2** The system SHALL close the profile menu when the user presses **Escape** while focus is inside the menu or on the trigger, without leaving the user in an inconsistent focus state.

**FR-3** The system SHALL close the profile menu when the user clicks or taps **outside** the menu surface (backdrop / “click-outside”), except when the click opens another modal that replaces it (document any such exception in implementation notes).

**FR-4** The system SHALL close the profile menu when the user activates the **same trigger** control again (toggle behavior), if the component pattern is a disclosure/dropdown; if the pattern is strictly “open only,” document the intended pattern and align with design system components.

**FR-5** The system SHALL ensure that after dismissal, **keyboard focus** is restored or moved per WCAG-compliant patterns for the underlying primitive (typically focus on the trigger or the element that logically continues the task).

**FR-6** The system SHALL not leave **inert** or **pointer-events** overlays active after the menu is closed (no invisible blocking layer).

---

## 6. Non-functional requirements

**NFR-1** Profile menu open/close interactions SHALL meet **WCAG 2.1 AA** expectations for keyboard operation, focus visibility, and focus order (no keyboard trap).

**NFR-2** Opening and closing the profile menu SHALL not cause **layout shift** beyond what is normal for the menu surface itself (CLS regression threshold: no new sustained overlay that shifts main content unexpectedly).

**NFR-3** Dismissal SHALL complete within **≤ 200 ms** from the triggering user input to a **non-interactive closed state** on supported CI/browser targets, with no perceptible “stuck open” state. **CI measurement (Playwright):** record a timestamp immediately before the dismiss action (e.g. the `click()` / `keyboard.press('Escape')` / navigation step that should close the menu), then assert `expect(menuContentLocator).toBeHidden({ timeout: 200 })` (or assert `data-state="closed"` on the Radix content/root if using a stable locator); elapsed wall time from the recorded start to assertion success is the observed latency.

---

## 7. Acceptance criteria

**AC-1** Given the profile menu is open,  
When the user selects a navigation item that changes the primary view,  
Then the profile menu is closed and the new view is usable without the menu overlay.

**AC-2** Given the profile menu is open,  
When the user presses Escape,  
Then the profile menu closes and focus behavior matches the design system / Radix (or equivalent) guidelines.

**AC-3** Given the profile menu is open,  
When the user clicks on main page content outside the menu,  
Then the profile menu closes.

**AC-4** Given the profile menu is open,  
When the user activates the profile trigger a second time (if toggle is supported),  
Then the profile menu closes.

**AC-5** Given the profile menu was open and is now closed,  
When the user attempts to interact with primary content (scroll, click buttons, follow links),  
Then interactions succeed without an invisible blocker.

**AC-6** Given the profile menu is open,  
When the user navigates with Tab / Shift+Tab through focusable elements,  
Then focus does not cycle inside the menu unless that is the documented pattern for a modal dialog; for a dropdown, focus moves predictably and the menu can still be dismissed per AC-2 and AC-3.

---

## 8. Edge cases and clarifications

| Scenario | Expected behavior |
|----------|-------------------|
| Menu open, user resizes window | Expected: menu closes or repositions per component library; should not remain a stale full-screen blocker. |
| Menu open, route change via browser back/forward | Expected: menu closes or unmounts with the shell; no orphaned overlay. |
| Nested submenus (if any) | Closing parent closes children; Escape closes innermost first where applicable. |
| Mobile / narrow viewport (sheet vs dropdown) | Same dismissal rules apply to the actual profile surface (sheet, drawer, or menu). |
| Concurrent with toast or modal | Profile menu closes when focus moves to modal, or modal stacks correctly without dead zones (implementation must pick one consistent stacking model). |

---

## 9. QA and test strategy (senior QA)

### 9.1 Risk-based priority

**High:** Dismissal on navigation, Escape, and click-outside — these are the reported regression vectors.

**Medium:** Focus restoration and keyboard traversal.

**Lower:** Visual regression of the closed state (no ghost shadow / border).

### 9.2 Recommended automation

1. **Playwright E2E (preferred for regression)**  
   - Authenticate with the project’s standard fixture or `storageState`.  
   - Open the profile menu via the trigger (`getByRole` / accessible name).  
   - Assert menu surface visible.  
   - Case A: `Escape` → assert menu hidden.  
   - Case B: `page.mouse.click` on a known safe coordinate in main content (or `getByRole` for main landmark) → assert menu hidden.  
   - Case C: activate a stable menu item that navigates → assert menu hidden and URL or heading expectation.  
   - Avoid `waitForTimeout`; rely on web-first assertions.

2. **Accessibility**  
   - After open and after close, run `@axe-core/playwright` with WCAG 2.1 AA tags on the affected route.  
   - Manual spot-check: visible focus indicator on trigger after close.

3. **Component level (optional)**  
   - If the profile menu is a thin wrapper around `@hypha/ui` `DropdownMenu`, add a Vitest + Testing Library test for controlled `open` state if the bug was state-related; otherwise E2E remains the source of truth for integration bugs.

### 9.3 Test data / environment

- Use a stable test user and a route where the profile trigger is always present (document the chosen route in the test file).  
- Run in CI headless Chromium; mirror local debugging with `--trace on` for flaky dismissal timing.

### 9.4 Definition of Done (QA)

**QA validation in progress:** Checklist below is the **target** DoD; items stay unchecked until executed and signed off (aligns with traceability **Status**: Implemented, pending QA).

- [ ] All AC-1–AC-6 pass on desktop viewport.  
- [ ] Spot validation on mobile viewport or documented shell breakpoint.  
- [ ] Automated test merged or explicitly waived with reason (only if infeasible in CI).  
- [ ] No new critical or serious axe violations on the touched page(s).

---

## 10. Implementation notes (non-normative)

- Regressions in “menu won’t close” often come from **controlled open state** not syncing with Radix `onOpenChange`, **`modal={false}`** combined with custom overlays, **nested portals**, or **preventDefault** on document clicks. Implementation should align with the design system primitive defaults unless there is a documented need to diverge.  
- The exact trigger selector and menu items should be taken from the implemented shell once the owning component is identified.

---

## 11. Open questions

| ID | Question | Owner | Target |
|----|----------|-------|--------|
| OQ-1 | Which routes and layouts render the profile menu (web only vs. other apps)? | Engineering | **Partially resolved:** `ConnectedButtonProfile` in `apps/web` root `layout.tsx` (all locales). Other apps: not used elsewhere yet. |
| OQ-2 | Is the profile surface a `DropdownMenu`, `Popover`, or responsive `Sheet`? | Design / Engineering | **Resolved** in [PR #2047](https://github.com/hypha-dao/hypha-web/pull/2047): Radix `DropdownMenu` on **desktop** (`md+`); **mobile** uses the full-screen shell menu (stacked links, not a dropdown). |
| OQ-3 | Are any menu items required to keep the menu open after click (e.g. “Copy address”)? | Product | **None required** in current `ButtonProfile` implementation; confirm with Product before FR-1 sign-off if new actions are added. |

---

## 12. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-03-24 | Requirements + QA (agent) | Initial specification from GitHub #1790 |
