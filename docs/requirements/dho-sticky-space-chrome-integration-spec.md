# DHO Sticky Space Chrome Integration Spec

## Context

The DHO page banner and compact sticky row must behave as one progressive chrome
system, not as two unrelated headers. As the user scrolls, the hero should
compress into a compact sticky state that preserves identity, action, and
navigation continuity without sending the user back to the top of the page when
switching DHO sections.

## Goals

- Make the compact sticky chrome feel like the large hero simplified itself.
- Dock the DHO section tabs into the same chrome system.
- Preserve scroll depth when navigating between DHO sections.
- Ensure sticky offsets and width always match the real panel geometry.
- Keep activation thresholds robust to dynamic top-menu height changes.
- Remove drift, flicker, and detached-overlay feel.

## Problems Identified

- The previous implementation used a binary `stuck` handoff, so the compact
  banner appeared as a separate header instead of a progressive state.
- The hero actions moved via portal target swapping, which could remount
  descendants and make the transition feel more mechanical.
- The DHO tab rail was separate from the sticky chrome and did not preserve
  scroll when navigating between sections.
- Sticky top offset depended on CSS variable observation and could drift if the
  menu-top metrics changed unexpectedly.

## UX Model

### Three visual phases

1. `expanded`
   - Full hero image, title, links, description, metadata, actions.
2. `collapsing`
   - Description and secondary metadata fade first.
   - Title/avatar remain visually continuous.
   - Compact sticky row gains opacity while the hero simplifies.
3. `compact`
   - Sticky identity row plus attached DHO tab rail.
   - Keeps the user oriented while working lower in the page.

### Expanded vs compact information

Expanded hero keeps:
- logo/avatar
- full title
- hero image
- description
- links
- members / agreements / created-on metadata
- primary action

Compact sticky state keeps:
- logo/avatar
- title
- primary action cluster
- top-level DHO tabs

Compact state intentionally drops:
- description
- links
- verbose metadata strip

## Architecture Decisions

1. **Single progressive chrome model**
   - `DhoStickySpaceChrome` owns the collapse progress and renders both the
     in-flow and sticky forms of the chrome.
   - The hero receives collapse progress so it can simplify before the sticky
     row becomes fully interactive.

2. **Measured panel insets as source of truth**
   - Use the existing live panel inset variables for the fixed compact chrome.
   - Keep the sticky row physically attached to the main DHO column as side
     panels open, collapse, or resize.

3. **Stable top offset synchronization**
   - Continue reading `--menu-top-height` from root styles and recompute the
     collapse threshold whenever it changes.

4. **Tabs are part of the chrome**
   - Render the DHO section tabs as part of both the in-flow and compact states.
   - Use `scroll={false}` on tab links so switching sections preserves scroll
     depth instead of resetting the page to the top.

## Implementation Scope

- `apps/web/src/app/[lang]/dho/[id]/_components/dho-sticky-space-chrome.tsx`
  - Replace the binary handoff with a progress-driven collapse model.
  - Render sticky identity and attached tabs as part of one fixed compact row.
  - Fade/disable the in-flow actions and tabs as the compact row takes over.

- `packages/epics/src/spaces/components/compact-space-banner.tsx`
  - Accept `collapseProgress`.
  - Gradually fade links, description, and metadata so the hero visually
    compresses into the sticky form.

- `apps/web/src/app/[lang]/dho/[id]/_components/navigation-tabs.tsx`
  - Support both page and compact variants.
  - Preserve scroll when switching sections.

- `apps/web/src/app/[lang]/dho/[id]/layout.tsx`
  - Treat the DHO tabs as part of the sticky chrome contract.
  - Pass collapse progress into the hero banner.

## Acceptance Criteria

- Sticky chrome aligns with content edges before and after opening/collapsing
  side panels.
- The hero visually simplifies into the compact banner instead of hard-swapping.
- DHO tabs appear attached to the compact banner in sticky mode.
- Switching between DHO sections does not force the main column back to top.
- Sticky activation engages at the correct scroll threshold after top-menu size
  changes.
- No regressions in md+ sticky visibility or panel interaction behavior.

## Out of Scope

- Mobile-specific sticky redesign.
- Persisting separate per-tab scroll memory beyond preserving current depth on
  immediate section switches.
