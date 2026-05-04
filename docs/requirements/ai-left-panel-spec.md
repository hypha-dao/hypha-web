# AI Left Panel — Product + Implementation Spec

## Document control

| Field | Value |
| --- | --- |
| Status | Ready for implementation |
| Target PR | `AI-Left Panel` |
| Base branch | `main` |
| Scope | Left panel information architecture, UX model, phased delivery |
| Constraint | Keep current left panel container and resize behavior |

---

## 1) Goal

Replace top content tabs with a persistent left navigation menu for Space pages, while keeping Hypha AI in the same left panel container.

### 1.1 Desired behavior

- Default view in left panel shows menu navigation (not AI chat).
- Clicking the AI icon (sparkles) switches the panel content to AI.
- Clicking the AI icon again returns to the menu view.
- A compact mode (`<`) shows only menu icons in the left panel.
- Left panel width must not jump when switching Menu <-> AI.
- Existing edge drag resize must continue to work.

### 1.2 Menu set (target IA)

- `Ecosystem` (new: space navigation in main panel, not modal)
- `Signals` (rename of Coherence)
- `Proposals`
- `Members`
- `Treasury`
- `Rewards` (currently surfaced inside Treasury)
- `Memory` (currently inside Coherence)
- `Space settings`

---

## 2) UX recommendation (answer to toggle question)

Yes, a toggle is the best UX approach for this constraint set, with one refinement:

- Use a 2-mode panel switch: `Menu` <-> `AI` in the same left rail.
- Keep the panel itself open and stable; switch content only.
- Keep one explicit, independent "Collapse to icons" control for Menu mode.

Why this is best:

- Preserves spatial memory: users always look left for navigation and AI.
- Avoids width/layout jitter: same container, same drag-resized width token.
- Fast context switching: one click between navigation and assistant.
- Lower cognitive load vs moving AI to a different location.

Anti-pattern to avoid:

- Reusing one control for both "close/open panel" and "menu/AI content mode". These are different user intents and should remain separate states.

---

## 3) UX model (state machine)

Left panel should have two independent state dimensions:

1. **Panel visibility**: `open | closed`
2. **Panel content mode**: `menu | ai`
3. **Menu density** (when `contentMode=menu`): `expanded | icon-only`

Normative behavior:

- Opening panel restores previous `contentMode`.
- AI icon toggles only `contentMode` between `menu` and `ai`.
- `<` collapse control changes only `menuDensity`.
- Drag-resized width token is shared by both `menu` and `ai` and persists across switches.

Suggested persisted keys:

- `leftPanel.contentMode`
- `leftPanel.menuDensity`
- width already stored through existing `--sidebar-width` runtime behavior

---

## 4) Navigation mapping (phase-safe)

To ship incrementally without breaking routing:

- `Signals` -> current `coherence` route
- `Proposals` -> current `agreements` route (label change only in phase 1)
- `Members` -> current `members` route
- `Treasury` -> current `treasury` route

Later-phase destination handling:

- `Rewards` -> Treasury rewards section deep-link/anchor (or dedicated subroute)
- `Memory` -> Coherence memory section deep-link/route
- `Ecosystem` -> new main-panel route replacing modal flow
- `Space settings` -> existing settings path currently reachable via actions

---

## 5) Technical design (Next.js + current architecture)

### 5.1 Existing architecture constraints

- Left sidebar shell is provided by `PanelWrapLayout`.
- Left panel currently mounts `AiLeftPanel`.
- AI trigger in top menu currently opens/closes left sidebar (`AiSidebarTrigger`).
- DHO content tabs are rendered via `@tab/layout.tsx` + `NavigationTabs`.

### 5.2 Target architecture

Introduce a new compositional wrapper in `packages/epics`:

- `SpaceLeftPanel` (new): renders either `MenuPanel` or `AiLeftPanel` inside same `Sidebar` shell.
- `SpaceLeftPanelProvider` (new/extended context): manages `contentMode` + `menuDensity`.
- Keep `SidebarResizeHandle` untouched.

High-level file impact:

- `packages/epics/src/common/panel-wrap-layout.tsx`
  - Add content-mode context wiring.
  - Keep left sidebar width behavior unchanged.
- `packages/epics/src/common/ai-left-panel.tsx`
  - Keep AI chat body mostly unchanged; update header actions to switch mode instead of closing panel in this flow.
- `apps/web/src/app/layout.tsx`
  - Mount `SpaceLeftPanel` in left slot instead of plain `AiLeftPanel`.
  - Update top sparkles action to toggle `menu <-> ai` mode (open panel if currently closed).
- `apps/web/src/app/[lang]/dho/[id]/_components/navigation-tabs.tsx`
  - Phase 1: keep for fallback compatibility.
  - Phase 2+: remove from visible chrome once left menu owns navigation.

### 5.3 Design system requirements (hypha stack)

- Use existing Sidebar primitives from `packages/ui/src/sidebar.tsx`.
- For icon-only mode, prefer `collapsible="icon"` pattern semantics.
- Keep token-based colors and spacing (`bg-background-2`, `text-muted-foreground`, etc.).
- Preserve focus-visible states and ARIA labels for all icon-only actions.

---

## 6) Phased implementation plan

## Phase 1 — Left Menu for existing 4 tabs (MVP)

Goal: ship requested behavior quickly using current routes.

Deliverables:

- New left menu (default mode) with items:
  - Signals, Proposals, Members, Treasury
- AI icon toggles panel content:
  - `menu` -> `ai`
  - `ai` -> `menu`
- No left width jump when switching modes
- Drag resize unchanged

Routing in this phase:

- Signals -> coherence
- Proposals -> agreements
- Members -> members
- Treasury -> treasury

Exit criteria:

- Users can navigate the 4 existing sections from left menu.
- AI remains available in same panel with one-click switch.

## Phase 2 — Icon-only mode and interaction hardening

Goal: deliver compact navigation without changing panel container behavior.

Deliverables:

- `<` control in menu header toggles `expanded` <-> `icon-only`.
- Tooltip labels on icon-only menu items.
- Keyboard navigation and roving focus across menu items.
- Persist `menuDensity` and `contentMode` between refreshes.

Exit criteria:

- Icon-only mode is fully usable, accessible, and reversible.
- Panel width remains stable across `menu/ai` switches.

## Phase 3 — Expand IA to full target menu set

Goal: add requested items beyond current 4 tabs.

Deliverables:

- Add menu items: Ecosystem, Rewards, Memory, Space settings.
- Implement route destinations:
  - Ecosystem as main-panel page (not modal)
  - Rewards + Memory via route or deep-link strategy
  - Space settings via existing settings path alignment
- Ensure selected-state logic works for nested/subpaths.

Exit criteria:

- Full target menu exists and routes correctly.
- No regressions in existing space actions/settings flows.

## Phase 4 — Cleanup and migration completion

Goal: remove legacy tab-strip dependency and finalize.

Deliverables:

- Remove visible top tab strip for migrated pages.
- Keep compatibility redirects/aliases where needed.
- Update i18n keys and naming (`Coherence` -> `Signals`, `Agreements` -> `Proposals` as product labels).
- Document final IA and telemetry events.

Exit criteria:

- Left menu is sole primary navigation in DHO space pages.
- Legacy tabs no longer required for user flows.

---

## 7) QA strategy (must pass each phase)

### 7.1 E2E scenarios (Playwright)

- Default render shows Menu mode in left panel.
- AI icon toggles to AI panel and back to Menu.
- Left panel width remains constant across mode switches.
- Drag resize works in Menu mode and AI mode.
- Icon-only mode shows icons + tooltips and navigates correctly.
- Active menu state reflects current route.

### 7.2 Accessibility checks

- All icon buttons have `aria-label`.
- Focus order is predictable in both modes.
- Color contrast stays AA in dark theme.
- Keyboard-only user can:
  - open/close panel
  - switch menu/AI mode
  - switch expanded/icon-only mode
  - activate navigation item

### 7.3 Regression tests

- Existing AI streaming/suggestions still work.
- Existing right chat panel behavior unaffected.
- DHO sticky chrome and main column layout unaffected.

---

## 8) Risks and mitigations

- **State coupling risk:** panel open state and content-mode state can conflict.
  - Mitigation: explicit state model and dedicated context contract.
- **Route naming confusion (Agreements vs Proposals, Coherence vs Signals):**
  - Mitigation: keep route slugs stable first, change labels first, then migrate URLs later if needed.
- **Layout regressions with fixed/sticky chrome:**
  - Mitigation: width invariance tests + screenshot regression on space pages.

---

## 9) Recommended rollout

- Ship Phase 1 behind a feature flag (`leftNavV2`).
- Enable for internal users first.
- Expand to Phase 2 and Phase 3 after telemetry confirms successful adoption:
  - AI toggle usage
  - menu navigation usage
  - collapse mode usage
  - no spike in back-navigation or bounce from space pages

---

## 10) Decision summary

- Toggle is the right interaction model if implemented as **content mode switch**, not panel close/open.
- Keep one stable left container with persistent width and resize.
- Deliver in phases: start with existing 4 tabs, then expand and finalize IA.
