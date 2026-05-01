# Technical Specification — DHO central left navigation (Vercel-inspired) + in-flow space graph

## Document control

| Field | Value |
|--------|--------|
| **Status** | Ready to implement (spec / design / QA only — no product code in this change) |
| **Related (product evolution)** | [DHO workspace — Signals, Artifact, icon-first rail, title alignment](./dho-workspace-signals-artifact-nav-ux-spec.md) (UX/IA: renames, new Artifact route, iconography, H1 ↔ rail alignment). Supersedes nav copy and order in this file where they conflict. |
| **Primary references** | [Vercel changelog — New dashboard navigation](https://vercel.com/changelog/new-dashboard-navigation-available) (sidebar + mobile bottom bar patterns as **UX inspiration**, not a dependency) |
| **In-repo anchors** | `PanelWrapLayout` + `--sidebar-left-width` (`packages/epics/src/common/panel-wrap-layout.tsx`); DHO tab chrome (`@tab/layout` → `DhoSpaceWorkspace`); legacy `.../select-navigation-action` URLs **redirect in middleware** to `/{lang}/dho/{id}/spaces` |
| **Out of scope for this spec PR** | Feature-flag rollout strategy, Figma handoff, and implementation PRs (tracked as follow-up work) |

---

## 0) Stakeholder framing (role lenses)

**UI/UX (design engineering)** — The central column should read like a **“workspace”**: a persistent, scannable **left rail** for the four (or five) main space areas, with the **graph** as a first-class “place” in that rail rather than a modal-only escape hatch. Mobile should mirror the Vercel direction: **a dedicated small-screen navigation pattern** (bottom bar and/or sheet) rather than squashing a desktop sidebar.

**Fullstack / Next.js** — Preserve **existing URL contracts** for Agreements / Members / Treasury / Coherence (`@tab` parallel routes) where possible. Introduce a **dedicated route segment** for the in-flow graph so deep links, aside closes, and AI chat open/close do not fight over overlay state. Prefer **layout composition** (tab layout + a new client “workspace shell”) over duplicating data loaders.

**QA** — Assert **panel coupling**: when the **AI left chat** opens, the new rail **moves with** the main column (same `--sidebar-left-width` transition the app already uses). Assert **route-level** navigation for each menu item, **mobile** access without horizontal-only affordances, and **accessibility** (landmarks, focus, keyboard).

---

## 1) Problem statement

Today, the DHO “space” experience mixes:

1. **(Prior)** Horizontal primary navigation as tabs — **replaced** by `DhoSpaceWorkspace` in `@tab/layout.tsx` for Coherence (optional) / Agreements / Members / Treasury / Spaces.
2. **(Prior)** Space navigation in a modal/ aside — **superseded** by in-flow **`/spaces`** + middleware redirect for old URLs.

**Product goals**

- Move primary section switching from **top tabs** to a **left navigation rail** in the **central (main) column**, visually aligned to the [Vercel “new dashboard navigation”](https://vercel.com/changelog/new-dashboard-navigation-available) *pattern* (persistent vertical nav; mobile-optimized nav).
- **Embed the space relationship graph in the main column** and expose it as a **left-nav item**, replacing the “popup-only” space navigation for primary discovery (aside may remain for power-user or deep flows if needed; see §6).
- **Synchronize** that rail with the **AI left chat panel**: as the off-canvas AI panel opens, the central content (including the rail) **shifts right smoothly**, using the same layout mechanism that already animates main-column inset width.

---

## 2) Goals, non-goals, and constraints

### Goals (must)

- **G1** — A **vertical nav** in the main column lists **Agreements**, **Members**, **Treasury**, and, when the coherence feature flag is on, **Coherence** — functionally replacing the current tab strip for those views.
- **G2** — A **“Spaces”** (working title) item shows the **space graph / nested spaces experience** in the main column via **`SpaceNavigationView`** (`SpaceVisualization` + `VisibleSpacesList`), not only behind the aside modal.
- **G3** — When the **AI left panel** toggles open in space context, the **entire main column** (nav + page body) **transitions in sync** with the existing 200ms `--sidebar-left-width` animation (see `PanelWrapLayout` in `packages/epics/src/common/panel-wrap-layout.tsx`).
- **G4** — **Mobile** users can reach all items without relying on a desktop-only left rail (see §5).

### Non-goals (this initiative)

- **NG1** — Rebuilding the AI or human chat panels, or changing default panel widths, unless required for layout bugs found during implementation.
- **NG2** — Replicating Vercel’s *exact* resizable corporate sidebar; Hypha’s left AI panel is product-specific. The spec only borrows **information architecture** and **mobile navigation philosophy**.
- **NG3** — Full redesign of the graph or list UIs — **reuse** existing building blocks; change **placement and entry points** first.

### Hard constraints

- **C1** — **`prefers-reduced-motion`**: optional subtle transitions may be disabled; no essential information should depend on motion alone.
- **C2** — **Internationalization**: all new labels go through `next-intl` namespaces used by DHO (extend `Common` / `DHO` / `DhoWorkspaceNav` as appropriate; follow [`i18n-translate`](../../.agents/skills/i18n-translate/SKILL.md) conventions).
- **C3** — **Accessibility**: the nav is a **navigation landmark** with **clear current location**; keyboard and screen reader behavior are implemented as **nav links** with `aria-current="page"` in `DhoSpaceWorkspace`.

---

## 3) Current implementation map (as-is)

| Concern | Location | Notes |
|--------|----------|--------|
| **AI / human panel layout + CSS vars** | `packages/epics/src/common/panel-wrap-layout.tsx` | Sets `--sidebar-left-width` / `--sidebar-right-width` on the wrapper and mirrors to `:root`; 200ms linear transition on those variables. **This is the coupling point for “smoothly moves when AI opens.”** |
| **DHO section nav** | `apps/web/src/app/[lang]/dho/[id]/@tab/layout.tsx` + `_components/dho-space-workspace.tsx` | Client workspace shell (left rail + mobile sheet); map paths via `getActiveTabFromPath`. |
| **Space graph** | In-flow `/{lang}/dho/{id}/spaces` with `SpaceNavigationView` | Old `.../select-navigation-action` path → **middleware** redirect to `/spaces`. |
| **Top chrome alignment** | `apps/web/src/app/layout.tsx` + `MenuTop` | `MenuTop` already uses `after:left` with `var(--sidebar-left-width)` so horizontal rules meet side panels. |

---

## 4) Target UX / IA (to-be)

### 4.1 Information architecture

**Central left rail (desktop / md+)** — Fixed width token (TBD; suggest **200–240px** content width + padding) inside the `SidebarInset` / main column, **to the right of** the AI off-canvas rail when it is open (because the whole inset shifts via existing layout). Visual hierarchy:

- **Space-scoped group** (optional label “Space” or context title — TBD in visual design)
  - **Coherence** (if `getEnableCoherence()`)
  - **Agreements**
  - **Members**
  - **Treasury**
  - **Spaces** (graph + lists — working title; copy review before ship)

**Main content** — Renders the existing `@tab` slot content. The rail **does not** replace the parallel routes; it **drives** them.

### 4.2 Route model (recommended)

**Option A (preferred) — new segment, minimal churn**

- Add a sibling segment such as `apps/web/src/app/[lang]/dho/[id]/@tab/spaces/`
  - `page.tsx` hosts the `SpaceNavigationView` body (or a thin wrapper that re-exports the same client tree with layout tweaks).
- Add path helper `getDhoPathSpaces(lang, id)` in a new `constants.ts` next to other tab routes.
- Update `getActiveTabFromPath` in `@hypha-platform/epics` to recognize **`spaces`** (and ensure **no tab value collision** with existing `agreements` | `members` | `treasury` | `coherence`).

**Option B — nested route under a route group** — only if A hits Next.js slot conflicts; avoid unless required.

**Deep link parity**

- Old aside URLs containing `/select-navigation-action` should **redirect (308/302) or client-navigate** to the new in-flow `spaces` route to avoid two sources of truth.

### 4.3 Replacing the tab strip

- Remove or stub **`NavigationTabs`** from `@tab/layout.tsx` once the rail is complete; keep **`getActiveTabFromPath` semantics** in sync.
- (Historical) Parallax on the old tab strip does not apply to the **workspace rail**; optional depth effects are out of scope unless re-specified.

### 4.4 Vercel-inspired notes (non-normative)

The [Vercel changelog](https://vercel.com/changelog/new-dashboard-navigation-available) highlights: **vertical sidebar**, **consistent links**, and **mobile navigation with a floating bottom bar for one-handed use**. Hypha should **not** copy Vercel branding or component code; use this as a **pattern reference** for:

- **Clear vertical scanning** of primary areas.
- **A distinct mobile entry** to primary navigation (see §5).

---

## 5) Responsive and mobile strategy

| Breakpoint | Behavior |
|------------|----------|
| **`< md`** | Do **not** rely on a fixed left rail that steals horizontal width. **Recommended pattern** (choose one in implementation, document the pick): (a) **bottom bar** with the same four/five items + “More” if needed, **or** (b) a **“Space menu”** button in `DhoStickySpaceChrome` / `CompactSpaceBanner` area opening a **sheet** / **drawer** listing the same entries. The nav content **must** match desktop entries (same routes). |
| **`md+`** | Persistent vertical rail; optional collapse control is **out of scope** unless requested later. |
| **Touch** | Hit targets **≥ 44px** for mobile controls; keep swipe gestures in `VisibleSpacesList` / graph interactions intact. |
| **Safe area** | If using a bottom bar, apply `env(safe-area-inset-bottom)` padding. |

---

## 6) Deprecating / repositioning the aside “space navigation”

**Intent:** Primary discovery moves to the **central `spaces` route** (§4.2). The aside path may:

- **D1** — 301/302 in middleware or page-level `redirect` to the central route, **or**
- **D2** — Keep as a **legacy deep link** for one release, logging client-side if hit, then remove.

**`NestedSpacesButton`**

- Changes from “open aside overlay” to “navigate to `getDhoPathSpaces`” (and optionally `scroll: false` if the graph is heavy — measure).

---

## 7) Engineering design

### 7.1 New component: `DhoSpaceWorkspace` (name TBD)

- **Type:** `client` component (needs pathname + maybe panel state).
- **Placement:** `apps/web/src/app/[lang]/dho/[id]/@tab/layout.tsx` **wraps** `{children}`: left rail + flex row for content.
- **Styling:** Tailwind 4 + design tokens; rail uses **neutral / muted** backgrounds consistent with `packages/ui` (see [Hypha UI stack](../../.agents/skills/hypha-ui-stack/SKILL.md)).

**Active state** — `usePathname` + `getActiveTabFromPath` (or a thin wrapper) to set `aria-current` on the active `Link`.

### 7.2 Coupling with AI left panel (smooth movement)

- **No new animation** is required for the *horizontal* shift if the rail lives inside the same **main column subtree** that already responds to `PanelWrapLayout`’s `SidebarProvider` + `PanelScrollInset`.
- **If** any part of the rail is `position: fixed` inside the main column, **it must** consume `--sidebar-left-width` the same way `MenuTop`’s `after` pseudo-element does, or be kept **in flow** to avoid special cases.

### 7.3 Server + client split

- **Server** (`@tab/layout.tsx` / server parents): pass `coherenceEnabled`, `lang`, `id`.
- **Client** (`DhoSpaceWorkspace`): nav links and optional mobile sheet state.

### 7.4 Performance

- The graph bundle may be heavy — use **`next/dynamic`** with `ssr: false` only if needed; **measure LCP/CLS** on the `spaces` page.
- Avoid **double data fetching** between the old aside and the new page during migration.

### 7.5 Analytics / observability (optional but recommended)

- `navigation_method`: `left_rail` | `bottom_bar` | `drawer` | `legacy_aside` for the Spaces entry.

---

## 8) Accessibility (normative)

- The rail (desktop) is wrapped in `<nav aria-label="Space">` (or i18n equivalent).
- Current page link uses `aria-current="page"`.
- Mobile sheet/bottom bar: on open, **move focus to the first item**; on close, **return focus to the activator**; **trap focus** inside the sheet when modal (if non-modal, follow **Radix** dialog/sheet recommended patterns from `packages/ui`).

---

## 9) QA and test plan (ready-to-execute when implemented)

| Area | Test type | Notes |
|------|------------|------|
| **Panel sync** | Playwright | On `/{lang}/dho/{id}/agreements` (or similar), open AI left panel: assert main column (and rail) **X offset** or bounding box shift; **no clipped focus rings**. Reuse patterns from e2e skill (feature flags, cookies) per [`e2e-testing`](../../.agents/skills/e2e-testing/SKILL.md). |
| **Routing** | E2E | Each nav item lands on the correct path; `Coherence` respects feature flag. |
| **Deep links** | E2E | `spaces` URL loads graph + lists without aside. |
| **Mobile viewport** | E2E + manual | `375×812` — bottom bar or drawer can reach all sections. |
| **A11y** | `@axe-core/playwright` | New surfaces scanned on navigation open/close. |
| **Reduced motion** | Unit / manual | `prefers-reduced-motion: reduce` does not break layout. |

**Regression watchlist** — `ProposalOverlayShell` z-index vs `Sidebar` (`z-[50]` in `PanelWrapLayout`), `NestedSpacesButton` `data-space-nav` e2e selectors, i18n for `DhoWorkspaceNav` (including space map copy).

---

## 10) Phased delivery (stages)

Stages are **sequential**; each should be shippable behind a feature flag if the team wants incremental rollout (flag design is implementation detail).

| Stage | Scope | Deliverables | Exit criteria |
|-------|--------|--------------|---------------|
| **0 — Discovery / UX sign-off** | Design tokens, copy for “Spaces”, mobile pattern decision | Figma or doc-approved wire: desktop rail + **one** mobile pattern; spacing tokens | Stakeholder approval |
| **1 — Shell** | `DhoSpaceWorkspace` in `@tab/layout.tsx` | Visual rail + **stub** routes / placeholders | Layout stable at `md+`; no double scrollbars; AI panel open/close looks smooth |
| **2 — Link parity** | Remove horizontal tabs; wire all items | Rail drives existing tab pages | `NavigationTabs` removed; keyboard + SR parity |
| **3 — Spaces page** | New `spaces` segment, move `SpaceNavigationView` | In-flow graph page | `NestedSpacesButton` points here; old aside **redirects** (if chosen) |
| **4 — Mobile** | Bottom bar or drawer | Responsive implementation | E2E on narrow viewport; safe-area verified |
| **5 — Hardening** | i18n, a11y polish, performance | Dynamic import tuning, copy pass | Axe clean; LCP within budget; legacy links monitored |
| **6 — Cleanup** | Remove dead aside route if safe | Code deletion PR | No remaining primary entry to legacy overlay |

---

## 11) Open questions (resolve before or during stage 0–1)

1. **Label** for the graph item — “Spaces”, “Map”, “Network”, or locale-specific?
2. **Default landing tab** for `/dho/[id]`: still Agreements, or the new `spaces` view?
3. Should **Coherence** sit above Agreements in the nav order for enabled spaces?
4. Is **resizable** main-column left rail in scope for a **later** iteration (Vercel’s sidebar is resizable — we are not shipping that now)?

---

## 12) Traceability

| Product requirement | Verification |
|---------------------|-------------|
| Central left nav | Visual + DOM `nav` in main column; tabs removed |
| Graph in main column | Public route `/{lang}/dho/{id}/spaces` renders `SpaceVisualization` |
| Smooth move with AI chat | E2E bounding box or computed style during `--sidebar-left-width` transition |
| Mobile works | E2E + manual on small viewport; bottom/sheet access |

---

*This document is intentionally implementation-ready but is **not** itself a runtime feature.*
