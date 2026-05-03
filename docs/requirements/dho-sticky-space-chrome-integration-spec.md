# DHO Sticky Space Chrome Integration Spec

## Context

The compact sticky space chrome on DHO pages must behave as a first-class extension of the main banner and layout system, not as a detached overlay. It must remain aligned when side panels open, collapse, and resize.

## Goals

- Keep sticky compact chrome visually and behaviorally integrated with the primary DHO banner.
- Ensure sticky offsets and width always match real panel geometry.
- Make sticky activation threshold robust to dynamic top-menu height changes.
- Preserve current visual tone while removing layout drift and flicker.

## Problems Identified

- Sidebar width CSS vars were mirrored from fixed constants instead of measured rendered widths.
- Sticky top offset depended on a CSS variable observer pattern that could go stale.
- Right inset fallback used an inconsistent scrollbar magic value, creating occasional edge drift.

## Architecture Decisions

1. **Measured panel insets as source of truth**
   - Read actual `[data-sidebar-gap]` widths.
   - Mirror measured left/right widths into layout vars used by sticky/fixed chrome.

2. **Stable top offset synchronization**
   - Observe root style/class mutations for `--menu-top-height` changes.
   - Recompute sticky threshold immediately when top-menu metrics change.

3. **Consistent inset math**
   - Remove non-zero magic fallback for scrollbar width in sticky right inset.
   - Keep zero-default behavior consistent with panel scroll inset defaults.

## Implementation Scope

- `apps/web/src/app/[lang]/dho/[id]/_components/dho-sticky-space-chrome.tsx`
  - Update menu-top offset hook observation strategy.
  - Normalize right inset fallback.

- `packages/epics/src/common/panel-wrap-layout.tsx`
  - Replace constant width mirroring with measured widths via `ResizeObserver`.
  - Track layout mutations so vars stay in sync through panel transitions.
  - Publish composed inset vars for integrated consumers.

## Acceptance Criteria

- Sticky bar aligns with content edges before and after opening/collapsing/resizing side panels.
- Sticky activation engages/disengages at correct scroll threshold after top-menu size changes.
- No right-edge visual jump caused by scrollbar fallback mismatch.
- No regressions in panel interaction or sticky visibility behavior on md+ breakpoints.

## Out of Scope

- Visual restyling of compact banner components beyond integration/alignment behavior.
- Mobile sticky behavior redesign.
