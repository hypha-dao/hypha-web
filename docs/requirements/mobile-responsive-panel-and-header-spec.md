# Mobile Responsive Panel and Header Spec

## Objective

Fix mobile and narrow-tablet responsiveness issues in the DHO experience:

1. Left and right side panels must always open from their trigger controls.
2. Header must not show two hamburger-like controls in mobile layouts.
3. Layout must switch to compact/mobile behavior before controls overlap (specifically when right panel trigger area approaches profile area).

This spec is implementation-ready for `apps/web` + `packages/ui` + `packages/epics`.

## Current Issues (Observed)

- **Panel controls fail to open in mobile states** due to inconsistent "mobile" detection (static CSS breakpoint in some places, runtime panel geometry in others).
- **Two menu affordances appear at once**:
  - `MenuTop` has an internal mobile hamburger button.
  - panel triggers (`AiSidebarTrigger`, `HumanSidebarTrigger`) also render as icon buttons.
- **Late responsive transition** causes top actions to collide/flow under each other in medium widths (around split view / right panel open).

## Design Principles

- Preserve existing desktop IA and behavior.
- Prioritize control clarity over feature density on narrow widths.
- Use one source of truth for "compact top bar" mode.
- Keep 44x44 minimum touch targets for all interactive controls.
- Do not hide critical actions without an equivalent accessible path.

## Scope

### In Scope

- Header top-bar interaction model (`MenuTop`, `ConnectedMenuTop`, `app/layout`).
- Panel trigger visibility and behavior (`AiSidebarTrigger`, `HumanSidebarTrigger`, `PanelWrapLayout`).
- Responsive switch logic based on **available action-row width**, not only viewport width.
- Accessibility and keyboard interaction for changed controls.

### Out of Scope

- Visual redesign of chat panel internals.
- Space banner redesign.
- Call dock redesign (except ensuring it does not block top-bar controls in compact mode).

## Target Behavior

### 1) Single Control Model in Compact Header

When compact mode is active:

- Keep **left panel trigger** visible at start of header row.
- Keep **profile avatar button** visible at end of header row.
- Keep **right chat trigger** visible as icon button near profile avatar.
- Hide `MenuTop` internal mobile hamburger button (or disable rendering path entirely).
- Navigation items currently inside `MenuTop` mobile fullscreen menu must move into profile menu (or another single, explicit overflow surface).

Result: user sees one clear panel trigger set + profile avatar; no duplicate hamburger.

### 2) Reliable Panel Opening on Mobile/Narrow Widths

- Left trigger always toggles AI panel open/closed in space routes.
- Right trigger always opens chat panel on tap/click in space routes.
- In compact mode, when one panel opens, the opposite panel closes (mutual exclusivity to avoid overlap and offscreen interactions).
- Right panel in compact mode opens as full-width offcanvas sheet (`100vw` minus left rail only if left rail is visible; otherwise full viewport width).

### 3) Early Responsive Switch (Collision-Avoidance)

Replace hard-only `max-width: 767px` top-bar switching with a collision-aware threshold:

- Compute available action-row width in runtime.
- Enter compact mode when:
  - viewport `< md` **OR**
  - measured free horizontal space between logo group and trailing actions is below safe threshold.

#### Safe threshold definition

- `safeThresholdPx = 232` minimum (chat trigger + profile + spacing + tolerance).
- If `freeSpacePx < safeThresholdPx`, compact mode = `true`.
- Add 24px hysteresis to avoid flicker:
  - enter compact below `232`
  - exit compact above `256`

This ensures the UI switches before right-side controls touch/overlap the profile area.

## Technical Implementation Plan

## A. Introduce Shared Compact Header State

Create `useCompactHeaderMode` (client hook in `packages/epics/src/common` or `packages/ui` depending ownership) that returns:

- `isCompactHeader: boolean`
- `headerMetrics` (optional debug info: `freeSpacePx`, `viewportWidth`)

Inputs:

- viewport width media query (`(max-width: 767px)` baseline),
- element refs from header (`left cluster`, `right cluster`, full row).

Behavior:

- evaluate in `ResizeObserver` + window resize,
- apply hysteresis.

## B. Refactor `MenuTop` to be Controlled

File: `packages/ui/src/organisms/menu-top.tsx`

Add props:

- `showMobileHamburger?: boolean` (default `true` for backwards compatibility),
- `isCompactHeader?: boolean` (optional; for class toggles),
- `rightSlot?: ReactNode` (optional explicit cluster for profile/chat actions when compact).

Changes:

- render current internal mobile hamburger only when `showMobileHamburger !== false`,
- keep existing menu open state only for screens/routes that still require it.

## C. Wire Compact Header in `ConnectedMenuTop` and Root Layout

Files:

- `apps/web/src/components/connected-menu-top.tsx`
- `apps/web/src/app/layout.tsx`

Changes:

- pass `showMobileHamburger={false}` for DHO/space shell.
- pass compact mode signal from parent or derive inside connected component with refs.
- ensure right-side row composition order in compact mode is:
  1. chat trigger (`HumanSidebarTrigger`)
  2. profile avatar (`ConnectedButtonProfile`)

Move mobile navigation links currently exposed by `MenuTop` fullscreen menu into `ConnectedButtonProfile.navItems` (already present) and verify parity.

## D. Panel Trigger and Sidebar Coordination

File: `packages/epics/src/common/panel-wrap-layout.tsx`

Changes:

- replace duplicated `matchMedia('(max-width: 767px)')` checks with shared compact header mode where relevant.
- enforce compact mutual exclusivity:
  - opening left panel closes right panel in compact mode,
  - opening right panel closes left panel in compact mode.
- keep desktop behavior unchanged (both can remain independently open).

File: `packages/epics/src/common/panel-wrap-layout.tsx` (`HumanSidebarTrigger`, `AiSidebarTrigger`)

- ensure triggers do not auto-disappear while needed in compact mode.
- keep `aria-expanded` accurate.

## E. Responsive CSS Guardrails

- In compact mode, top bar right action cluster uses `flex-shrink-0`.
- Logo container should be `min-w-0` + truncate text/logo safely.
- Avoid hidden overflow clipping interactive icons.

## Accessibility Requirements

- Trigger buttons:
  - minimum target `44x44` (visual can remain 32 if padded touch area is added),
  - clear `aria-label` values ("Open chat panel", "Open AI panel", etc.),
  - maintain `aria-expanded`.
- Keyboard:
  - `Enter/Space` activate triggers,
  - focus visible ring on all compact controls.
- Screen reader:
  - no duplicate controls with same purpose in compact mode.

## QA Acceptance Criteria

### Functional

- On iPhone-sized widths, tapping left trigger opens AI panel.
- On iPhone-sized widths, tapping chat trigger opens right panel.
- Only one hamburger/menu affordance exists in compact header.
- Profile avatar remains visible at all compact widths.
- When right panel opens in compact mode, header remains non-overlapping and usable.

### Adaptive Threshold

- At intermediate widths (as in provided screenshot 2), compact header activates **before** overlap with profile area.
- Resizing back to wide desktop exits compact mode without flicker.

### Regression

- Desktop (`>= 1024px`) keeps existing behavior and layout.
- Non-space routes are unaffected.
- No hydration mismatch warnings from header measurement logic.

## Test Plan

1. Manual viewport tests:
   - 375x812, 390x844, 768x1024, 820x1180, 1024x768.
2. Manual interaction:
   - open/close left panel, right panel, profile menu in each viewport.
3. Add/update Playwright spec:
   - assert single header menu affordance in compact mode,
   - assert chat/AI trigger open panel states.
4. Accessibility smoke:
   - keyboard navigation across header controls,
   - axe scan for duplicate-label or contrast regressions.

## Rollout Notes

- Feature flag optional but not required; change can ship directly if QA passes.
- If needed, temporarily log compact-mode transitions in dev for tuning threshold:
  - `freeSpacePx`, `isCompactHeader`, `viewportWidth`.

## Implementation Checklist

- [ ] Add shared compact header mode hook with hysteresis.
- [ ] Update `MenuTop` to support disabling internal mobile hamburger.
- [ ] Wire compact mode and action ordering in `ConnectedMenuTop` + `app/layout`.
- [ ] Update panel toggle coordination in `PanelWrapLayout`.
- [ ] Verify accessibility semantics and focus behavior.
- [ ] Add/adjust Playwright coverage for compact header + panel triggers.

