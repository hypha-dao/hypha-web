# DHO workspace navigation — delivery notes (Phases 0–6)

## Document control

| Field           | Value                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Status**      | Phases 0–6 complete in code                                                                                             |
| **Inspiration** | [Vercel — New dashboard navigation](https://vercel.com/changelog/new-dashboard-navigation-available) (IA patterns only) |

## Phase 0 — Locked decisions (UX / engineering)

1. **Copy — Ecosystem (graph tab)** — Nav uses **`Common` → `Ecosystem`**. Canonical route **`/spaces`**; optional alias **`/ecosystem`** redirects to `/spaces` (see `getActiveTabFromPath` for segment `ecosystem`).
2. **Default space landing** — Bare **`/[lang]/dho/[id]`** redirects to **Signals** (`/coherence`) when Coherence is enabled (feature flag), otherwise to **Ecosystem** (`/spaces`). In-flow tabs still include Agreements, Members, Treasury, etc.
3. **Nav order** — **Ecosystem first**, then **Signals** when Coherence is enabled, then Agreements, Members, Treasury, Rewards, Wiki (when enabled), and Space settings at the bottom of the rail.
4. **Mobile** — **Left sheet** + floating **Space menu** (not a full-width bottom bar).
5. **Layout tokens (desktop rail)** — Fixed rail **`min(15rem, 100%)`**, in-flow with **`PanelWrapLayout`**.

## Phases 1–4 (summary)

- **1 —** `DhoSpaceWorkspace` shell, `getDhoPathSpaces`, `getActiveTabFromPath` updates.
- **2 —** Horizontal tabs removed; workspace nav only.
- **3 —** In-flow graph on `/spaces`, `NestedSpacesButton` → `getDhoPathSpaces`, middleware redirect for legacy path.
- **4 —** E2E + Axe on main column, `data-testid` on main, `@axe-core/playwright`.

## Phase 5 — Hardening (spec “Stage 5”)

- **`SpaceNavigationView`** — Renamed from **`SelectNavigationAction`**; only used by the `/spaces` tab. Heavy **`SpaceVisualization`** (d3) loads via **`next/dynamic` (`ssr: false`)** with an accessible loading placeholder and **`DhoWorkspaceNav.spaceMapLoading`** i18n.
- **`SelectAction`** — Optional **`className`** on the root for layout density.
- **Middleware** — Response header **`x-hypha-legacy-redirect: dho-spaces`** on legacy redirect; **dev** `console.info` for the same.
- **E2E** — Axe on **`dho-workspace-main`** and **`dho-space-navigation-view`**; **German** `/de/.../spaces` rail + tab copy; assert redirect header; testids **`dho-space-nav-map`**, **`dho-space-nav-map-tabs`**, **`dho-space-navigation-view`**.

## Phase 6 — Cleanup (spec “Stage 6”)

- **Removed** `select-navigation-action.tsx` (replaced by **`space-navigation-view.tsx`**).
- **Docs** — Central spec and coherence plans no longer point at deleted `navigation-tabs.tsx`; copy updated to **`SpaceNavigationView`**.

## Follow-up (product)

- **Signals / Wiki / world-class nav** — Space memory lives in the **Wiki** tab (URL segment `wiki`, former `artifact` redirects). [dho-workspace-signals-artifact-nav-ux-spec.md](./dho-workspace-signals-artifact-nav-ux-spec.md) documents **Signals** and the **icon-first** rail; Wiki naming supersedes “Artifact” for that surface.
- **Members tab card grid** — [dho-members-tab-card-grid-ux-spec.md](./dho-members-tab-card-grid-ux-spec.md) specifies moving the Members tab from a **vertical list of wide cards** to a **compact responsive card grid** (person + nested space), full data mapping, and **reserved badge row** (badges not shown in v1).
- **Ecosystem view (spaces / graph)** — [dho-ecosystem-view-ux-spec.md](./dho-ecosystem-view-ux-spec.md) renames the nav to **Ecosystem**, full-bleed **map** (out of the inner box), **above-the-fold** data placement, and bounded **“wow”** effects; other tab contents completed later.
- Optional full-page Axe in CI, visual baselines for `/spaces`, or performance budgets for the d3 bundle.
