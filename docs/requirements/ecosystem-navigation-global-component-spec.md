# Ecosystem Navigation Global Component Spec

## Objective

Introduce a new left-menu entry named **Ecosystem Navigation** with an icon in
the same visual language as existing sidebar icons, and render the ecosystem
diagram experience in the main panel as a reusable global component that can be
adopted later by other surfaces (including proposals).

This phase delivers **ready-to-implement specs only**.

## Product Requirements

1. Add a new left-menu item:
   - Label: `Ecosystem Navigation`
   - Icon: inspired by the provided reference image (orbital/space graph feel),
     but matching current menu icon weight, stroke, sizing, and active behavior.

2. Main panel content:
   - Display the ecosystem diagram in a polished container.
   - Add a subtle accent underlay ("WOW" effect) beneath the diagram.
   - Keep the diagram fully visible in viewport height (no content hidden below
     fold by default on desktop).

3. Node interactions:
   - Hover shows the space label (same behavior as current implementation) with
     improved visual styling.
   - Clicking a space keeps the **existing animation behavior** unchanged.
   - On hover/focus, show an action menu below the label with:
     - `Add Space`
     - `Visit Space`

4. Mode tabs:
   - Keep three tabs:
     - `Nested Spaces`
     - `Space-to-Space`
     - `Value Flows`
   - Tabs must integrate with the main app chrome and design tokens.

5. Reusability:
   - Implement as a global component (not page-local only).
   - Ship global component in a dedicated separate commit.

## Existing Baseline (Must Reuse)

- Left menu foundation:
  - `packages/epics/src/common/ai-left-panel.tsx`
  - `packages/ui/src/sidebar.tsx`
- Current ecosystem visualization + tabs:
  - `apps/web/src/app/[lang]/dho/[id]/_components/select-navigation-action.tsx`
  - `apps/web/src/app/[lang]/dho/[id]/_components/space-visualization.tsx`
  - `apps/web/src/app/[lang]/dho/[id]/_components/visible-spaces-list.tsx`
- Existing click-to-zoom transition semantics:
  - Keep `SpaceVisualization` transition behavior and timing unchanged.

## Functional Requirements

### FR-1: New Sidebar Item

- Add `Ecosystem Navigation` to the left menu model in `AiLeftPanel`.
- Keep exact alignment rules used by current menu items:
  - same icon frame, active tint, hover treatment, collapsed tooltip behavior.
- Route target should open ecosystem navigation view in main panel.

### FR-2: Diagram Container with Accent Underlay

- Render diagram in a container with:
  - `rounded-xl` shell,
  - subtle border and neutral surface,
  - one low-opacity accent glow underlay behind diagram content.
- Avoid multi-layer effects; keep sober/classy style aligned with app.

### FR-3: No-Below-Fold Height Contract

- Desktop (md+): default visible area must keep full diagram container in view.
- Height must be computed from available viewport minus top chrome/panel offsets.
- No double-scroll ownership between parent and diagram wrapper.

### FR-4: Hover Label + Action Menu

- Keep current label content (space name) on hover.
- Improve label visual treatment (pill, border, better contrast).
- Show actions below label on hover/focus:
  - Visit Space
  - Add Space
- Menu must be keyboard accessible (Enter/Space/Escape/arrows).

### FR-5: Preserve Existing Space Transition

- Clicking node/logo keeps current space focus transition exactly as now.
- No animation regression in duration/easing/zoom interpolation.

### FR-6: Mode Tabs Integration

- Keep three tabs visible and integrated with main container:
  - Nested Spaces
  - Space-to-Space
  - Value Flows
- Use existing app tabs primitives and tokenized visual states.
- Retain "coming soon" placeholder behavior for non-implemented modes if needed.

### FR-7: Reusable Global Component

- Extract reusable component module under epics common layer.
- Keep route/data-source specifics in thin adapter components.

## Component Architecture

### New Global Module

Create under:

- `packages/epics/src/common/ecosystem-navigation/`

Proposed files:

- `ecosystem-navigation-root.tsx`
- `ecosystem-navigation-shell.tsx`
- `ecosystem-navigation-tabs.tsx`
- `ecosystem-space-hover-label.tsx`
- `ecosystem-space-actions-menu.tsx`
- `ecosystem-navigation-types.ts`
- `ecosystem-navigation-grouping.ts`
- `ecosystem-navigation-reducer.ts`

### Adapter Layer

Create app-specific adapters (thin wrappers):

- DHO adapter (first consumer):
  - `apps/web/src/app/[lang]/dho/[id]/_components/ecosystem-navigation-adapter.tsx`
- Later proposal adapter (future phase):
  - separate consumer using same global component contract.

### Core Props Contract (Initial)

- `spaces`: normalized array with id, slug, title, logoUrl, parentId.
- `activeSpaceId` / `activeSpaceSlug`.
- `onSelectSpace(space)` for route navigation.
- `onVisitSpace(space)` and `onAddSpace(space)`.
- `mode` + `onModeChange` (`nested-spaces`, `space-to-space`, `values-flows`).
- `onVisibleSpacesChange` passthrough from visualization.
- i18n labels provided by consumer.

## UX and Design Tokens

### Icon Style (Left Menu)

- Match current icon standard from `AiLeftPanel`:
  - icon size `h-4 w-4`,
  - container aligned with existing `ICON_COLUMN_CLASS`,
  - color by state:
    - default: muted
    - hover: foreground
    - active: accent tint.

### Diagram WOW Underlay (Subtle)

- One accent glow layer behind diagram only.
- Suggested direction:
  - radial accent wash with low opacity,
  - soft blur,
  - no animated pulse by default.
- Must not reduce label readability or edge contrast.

### Hover Label + Menu Styling

- Label: rounded pill, compact, medium-weight text, border and subtle surface.
- Menu: compact dropdown/popover style consistent with current app menus.
- Vertical attachment: menu appears directly under the hovered label.

### Tabs

- Use `Tabs`, `TabsList`, `TabsTrigger` from `@hypha-platform/ui`.
- Keep switch/chip treatment consistent with current app tabs.

## Accessibility Requirements

- Icon-only collapsed mode must expose tooltip + `aria-label`.
- Hover-only interactions require keyboard equivalent:
  - focus triggers label state,
  - Enter/Space opens action menu,
  - Escape closes menu.
- Tabs must remain ARIA-compliant (`tablist`, `tab`, `aria-selected`).
- Maintain WCAG AA contrast for text and controls.
- Respect reduced motion preference for non-essential effects.

## Performance Requirements

- Keep D3 transition pathway unchanged where possible.
- Do not trigger expensive re-layout loops from tooltip/action menu state.
- Memoize derived data (`visibleSpaces`, grouping, active state selectors).
- Avoid re-rendering full visualization on simple label/menu hover changes.

## Risks and Guardrails

- Do not break current left-panel collapse/overlay behavior.
- Do not regress current route active-state semantics in left menu.
- Do not alter existing click transition timing or interpolation.
- Ensure action menu permissions can be disabled/hidden without layout break.
- Keep i18n key additions scoped and backward compatible.

## Acceptance Criteria

- New left menu item `Ecosystem Navigation` appears with icon parity to other
  menu entries in both expanded and collapsed states.
- Selecting `Ecosystem Navigation` renders diagram experience in main panel.
- Diagram container includes subtle accent underlay without visual clutter.
- On desktop default view, diagram content is fully visible in height.
- Hovering/focusing a space shows enhanced label and action menu beneath it.
- Clicking a space preserves existing transition behavior.
- Tabs render and switch cleanly with integrated app styling.
- Component contract is reusable and extracted to global module.

## File Mapping (Implementation)

- Sidebar item + route wiring:
  - `packages/epics/src/common/ai-left-panel.tsx`
  - route/layout consumer wiring under DHO app segment
- Reusable component:
  - `packages/epics/src/common/ecosystem-navigation/*`
- DHO adapter:
  - `apps/web/src/app/[lang]/dho/[id]/_components/*ecosystem-navigation*`
- Existing visualization integration:
  - `apps/web/src/app/[lang]/dho/[id]/_components/space-visualization.tsx`
  - `apps/web/src/app/[lang]/dho/[id]/_components/select-navigation-action.tsx`

## Commit Plan

1. `refactor(ecosystem-nav): extract shared models and reducer`
   - Add pure types/grouping/reducer helpers (no behavior changes).

2. `feat(ecosystem-nav): add reusable global ecosystem navigation component`
   - **Dedicated global component commit** (required by request).
   - Add reusable shell, tabs wrapper, hover label, actions menu.

3. `feat(dho): integrate ecosystem navigation global component in main panel`
   - Wire DHO adapter and route-level usage.

4. `feat(sidebar): add ecosystem navigation menu item and icon`
   - Add new left menu item and active-route behavior.

5. `style(ecosystem-nav): add subtle accent underlay and viewport-fit height`
   - Final visual polish and no-below-fold sizing contract.

6. `test(ecosystem-nav): cover hover actions, tabs, and transition parity`
   - Add/extend tests and run validations.

## Test Plan

- Unit:
  - grouping logic, reducer transitions, mode switching state.
- Integration:
  - hover label/menu interaction and keyboard flow.
  - route callback wiring for visit/add actions.
- E2E:
  - open ecosystem navigation from left menu.
  - click node retains current transition behavior.
  - tabs switch across three modes.
  - viewport height contract on desktop (diagram remains fully visible).

## Open Questions Before Implementation

- Should `Add Space` be hidden or disabled when user lacks permission?
- Should `Visit Space` always route to `agreements` or preserve last tab?
- On touch devices (no hover), should actions open via tap or explicit overflow?
- For first release, keep `space-to-space` and `value flows` as placeholders or
  include minimal visual scaffolds?
