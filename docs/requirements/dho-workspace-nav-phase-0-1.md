# DHO workspace navigation — Phase 0–3 delivery notes

## Document control

| Field | Value |
|--------|--------|
| **Status** | Phases 0–3 implemented in code (in-flow Spaces map) |
| **Inspiration** | [Vercel — New dashboard navigation](https://vercel.com/changelog/new-dashboard-navigation-available) (IA patterns only) |

## Phase 0 — Locked decisions (UX / engineering)

1. **Copy — “Spaces”** — The graph route and nav item use the existing **`Common` → `Spaces`** string. No separate “Map/Network” label in this phase.
2. **Default space landing** — Unchanged: **`/agreements`** remains the default primary tab. The **`/spaces` stub** is reachable from the left nav; there is no redirect of the DHO index in this phase.
3. **Nav order** — When Coherence is enabled: **Coherence → Agreements → Members → Treasury → Spaces**. (Matches previous horizontal tab order with **Spaces** last as the new in-flow area.)
4. **Mobile pattern** — **Left sheet** opened by a **floating “Space menu”** control (bottom; safe-area aware). The same links as the desktop rail; **not** a full-width permanent bottom bar (avoids clashing with browser chrome and existing layout).
5. **Layout tokens (desktop rail)** — Fixed rail **`min(15rem, 100%)`**, **border-r** separator, `md+` only; in-flow (not `fixed`) so it **shifts with** the main column when the AI left panel animates (`--sidebar-left-width` in `PanelWrapLayout`).

## Phase 1 — What shipped

- **`DhoSpaceWorkspace`** client shell (`apps/web/src/app/[lang]/dho/[id]/_components/dho-space-workspace.tsx`) with desktop rail + mobile sheet.
- **Path helper** — `getDhoPathSpaces(lang, id)` → `/${lang}/dho/${id}/spaces` (`@tab/spaces/constants.ts`).
- **`getActiveTabFromPath`** recognizes the **`spaces`** (and `overview`) segment; unknown first segments under `/dho/[id]/` still **fall back to `agreements`** so other routes are not misclassified as active “tabs”.
- (Initially) opt-in via **`getEnableDhoWorkspaceNav`** — **removed in Phase 2** (see below).

## Phase 2 — What shipped (link parity)

- **`@tab` layout** always wraps tab content in **`DhoSpaceWorkspace`**. The horizontal **`NavigationTabs`** component was **removed** (`apps/web/.../navigation-tabs.tsx` deleted).
- The **`HYPHA_ENABLE_DHO_WORKSPACE_NAV` cookie, `getEnableDhoWorkspaceNav`, and `enable-dho-workspace-nav` Vercel flag** were removed; the workspace pattern is the only DHO tab navigation.
- **E2E:** Coherence navigation locators use **`link` + `aria-current`** instead of Radix **`tab`** (Coherence e2e page + spec updated).

## Phase 3 — What shipped (in-flow graph + redirect)

- **`/spaces` tab** renders **`SelectNavigationAction` with `variant="page"`** (intro + map + list; no empty foot section from `SelectAction`).
- **`epics` `SelectAction`**: new **`showActionCards={false}`** to omit the trailing separator and action-cards block when `actions` is empty (used by the page variant).
- **Aside** `select-navigation-action` is a **server `redirect` to** `getDhoPathSpaces(lang, id)` so old URLs keep working.
- **`NestedSpacesButton`** links to **`getDhoPathSpaces`** instead of the aside `PATH_SELECT_NAVIGATION_ACTION`.

## Follow-up (Phase 4+)

- E2E: optional assertions for `/spaces` and AI-panel offset; cleanup any remaining `PATH_SELECT_NAVIGATION` references in docs.
