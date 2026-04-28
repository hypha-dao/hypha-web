# AI Sidebar + Space Navigation Redesign Spec

## Objective

Rebuild the left-side AI/space navigation experience from scratch on a new branch
using the `sidebar-01` shadcn block pattern as the interaction baseline.

The redesign aligns Hypha's space navigation and AI panel chrome with the
expected behavior shown in the provided visual references, while preserving the
existing global top-menu behavior that is explicitly out of scope.

## References

- Shadcn block: `https://ui.shadcn.com/blocks/sidebar#sidebar-01`
- Interaction reference (overlay on top of chat): `https://v0.app/chat/Nl34hIcRqcf`
- User-provided image set (1-10) in this task thread

## Scope

### In Scope

- New left-rail + expanded sidebar behavior for AI/space context.
- Space switcher dropdown content and ordering.
- Space section menu items replacing tab-like controls.
- AI panel top chrome updates (icon/title/dropdown/controls).
- Collapsed state behavior after close action.

### Out of Scope

- Changes to existing right-side user/profile controls in global top menu.
- Changes to non-space routes.
- Backend/domain model refactors unrelated to sidebar behavior.

## Functional Requirements

### FR-1: Space Switcher Dropdown Content (Image 1)

- A dropdown next to the active space icon displays "My Spaces".
- The first section lists spaces inside the same ecosystem as the active space.
- A visible delimiter separates that section from "other spaces".
- Selecting a space navigates to that space route and updates active state.

### FR-2: Hover-Activated Left Menu (Image 2)

- Hovering the top-left entry icon reveals the sidebar menu overlay.
- Behavior and placement follow the v0 reference: menu appears layered over
  the AI chat region rather than shifting global layout.
- Keyboard fallback remains available (focus/trigger must open without hover).

### FR-3: Section Menu Items Replace Tabs (Image 3)

- Replace tab-like section controls with vertical menu items (icon + label):
  - Signals
  - Agreements
  - Members
  - Treasury
- Active route is highlighted as selected menu item.
- Items navigate to the existing section routes (no route rename in this phase).

### FR-4: Top AI Bar Updates (Images 4-8)

- Replace white AI icon with active space icon.
- Replace "Hypha AI" text with space dropdown trigger next to the icon.
- Keep remaining top menu elements unchanged unless explicitly listed here.
- Remove reload/reset action from the AI panel top controls.

### FR-5: Close-to-Collapsed Behavior (Images 9-10)

- Clicking close collapses the left panel into icon-only rail state.
- Collapsed state shows:
  - active space icon at top
  - vertical icon-only section navigation below
- Expanding from collapsed state restores full menu with labels and dropdown.

## UX + Accessibility Requirements

- Use existing design tokens and shadcn/sidebar primitives from `@hypha-platform/ui`.
- Hit targets: minimum `44x44` equivalent for interactive icons on touch contexts.
- Every icon-only control must have `aria-label` and tooltip text.
- Dropdown and menu must be keyboard navigable:
  - Enter/Space opens
  - Arrow keys move focus
  - Esc closes popover/menu where applicable
- Active menu item should expose `aria-current="page"` semantics.

## Technical Mapping

- `apps/web/src/app/layout.tsx`
  - Wire redesigned left trigger/menu integration in `MenuTop` composition.
- `packages/epics/src/common/ai-panel/ai-panel-header.tsx`
  - Update AI top bar: space icon + space switcher, remove reload.
- `apps/web/src/app/[lang]/dho/[id]/_components/navigation-tabs.tsx`
  - Replace tab presentation with menu-item pattern (icons + labels).
- `packages/epics/src/common/panel-wrap-layout.tsx`
  - Ensure collapsed icon rail state is supported without breaking existing panel
    open/close behavior.
- New helper component(s) under `packages/epics/src/common/` or
  `apps/web/src/app/[lang]/dho/[id]/_components/` for:
  - space grouping logic (ecosystem first, others second),
  - shared navigation config (label/icon/href/active).

## Data + State Requirements

- Active space metadata needed in client UI:
  - `space slug`
  - `space title`
  - `space icon URL` with fallback
  - `ecosystem group identifier` (for dropdown grouping)
- If ecosystem grouping data is unavailable, fallback behavior:
  - show all spaces in one list, no misleading grouping labels.

## Acceptance Criteria

- On a space route, top-left control reveals sidebar overlay on hover and focus.
- Space dropdown appears next to active space icon and supports selection.
- Dropdown groups spaces: same ecosystem first, delimiter, then other spaces.
- Section navigation appears as icon + label menu items, not tabs.
- Menu includes Signals, Agreements, Members, Treasury in that order.
- AI header no longer shows reload/reset action.
- Close action collapses to icon-only rail with active space icon + nav icons.
- Existing top-right menu behavior remains unchanged.
- No new lint/type errors in touched files.

## Implementation Plan (Execution Order)

1. Build shared nav item model (icon + route + active matcher).
2. Implement space switcher dropdown component and grouping logic.
3. Replace tab UI with vertical menu UI (desktop + collapsed variants).
4. Refactor AI panel header for space icon + dropdown and close/collapse actions.
5. Integrate hover-open trigger behavior in left-top menu entry.
6. Validate keyboard/accessibility behavior and run lint checks.

