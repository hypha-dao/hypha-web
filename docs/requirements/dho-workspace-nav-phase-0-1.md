# DHO workspace navigation — Phase 0 (UX decisions) and Phase 1 (shell) implementation

## Document control

| Field | Value |
|--------|--------|
| **Status** | Phase 0–1 implemented in code (feature-flagged) |
| **Inspiration** | [Vercel — New dashboard navigation](https://vercel.com/changelog/new-dashboard-navigation-available) (IA patterns only) |

## Phase 0 — Locked decisions (UX / engineering)

1. **Copy — “Spaces”** — The graph route and nav item use the existing **`Common` → `Spaces`** string. No separate “Map/Network” label in this phase.
2. **Default space landing** — Unchanged: **`/agreements`** remains the default primary tab. The **`/spaces` stub** is reachable only via the new nav; there is no redirect of the DHO index in Phase 1.
3. **Nav order** — When Coherence is enabled: **Coherence → Agreements → Members → Treasury → Spaces**. (Matches previous horizontal tab order with **Spaces** last as the new in-flow area.)
4. **Mobile pattern** — **Left sheet** opened by a **floating “Space menu”** control (bottom; safe-area aware). The same links as the desktop rail; **not** a full-width permanent bottom bar (avoids clashing with browser chrome and existing layout).
5. **Layout tokens (desktop rail)** — Fixed rail **`min(15rem, 100%)`**, **border-r** separator, `md+` only; in-flow (not `fixed`) so it **shifts with** the main column when the AI left panel animates (`--sidebar-left-width` in `PanelWrapLayout`).
6. **Feature flag** — Shell is off by default. Enable with **`NEXT_PUBLIC_ENABLE_DHO_WORKSPACE_NAV=true`** and/or cookie **`HYPHA_ENABLE_DHO_WORKSPACE_NAV=true`**, or the Vercel Flags Toolbar key **`enable-dho-workspace-nav`**.
7. **Path helper** — `getDhoPathSpaces(lang, id)` → `/${lang}/dho/${id}/spaces` (`@tab/spaces/constants.ts`).

## Phase 1 — What shipped

- **`DhoSpaceWorkspace`** client shell (`apps/web/src/app/[lang]/dho/[id]/_components/dho-space-workspace.tsx`) with desktop rail + mobile sheet.
- **`@tab` layout** switches between legacy **`NavigationTabs`** and **`DhoSpaceWorkspace`** when the flag is on.
- **Stub `spaces` tab page** with i18n placeholder copy until Phase 3 moves `SelectNavigationAction` in-flow.
- **`getActiveTabFromPath`** recognizes the **`spaces`** (and `overview`) segment; unknown first segments under `/dho/[id]/` still **fall back to `agreements`** so other routes are not misclassified as active “tabs”.

## Follow-up (Phase 2+)

- Remove **`NavigationTabs`** for the default path when the feature is on everywhere.
- Replace **`spaces` stub** with the real `SelectNavigationAction` graph; redirect aside **`select-navigation-action`** as per main tech spec.
- E2E: enable flag, assert nav links and panel-coupling.
