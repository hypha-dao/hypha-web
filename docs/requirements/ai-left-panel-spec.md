# AI-Left Panel — product and implementation specification

**Target:** Hypha web — space context (`/[lang]/dho/[id]/…`).  
**Constraint:** Keep the **existing left panel container** (`SidebarProvider` + left `Sidebar` in `PanelWrapLayout`; fixed `--sidebar-left-width` when open). **Do not** introduce a new outer shell; evolve **content inside** the left slot and coordination with the main column.

**References (current code):**

- Left AI shell: `packages/epics/src/common/panel-wrap-layout.tsx`, `apps/web/src/app/layout.tsx` (`left={{ content: <AiLeftPanel /> }}`).
- AI UI: `packages/epics/src/common/ai-left-panel.tsx`.
- Space tabs: `apps/web/src/app/[lang]/dho/[id]/_components/navigation-tabs.tsx` (Coherence, Agreements, Members, Treasury).
- Active tab from URL: `packages/epics/src/common/get-active-tab-from-path.ts`.

---

## 1. Goals

1. Replace **horizontal tabs** as the primary space navigation with a **vertical icon rail + labels** in the **left panel**, above the **existing AI chat** region.
2. **Collapsed** left panel shows **icons only** (with tooltips); **expanded** shows **icon + label** (matches reference: dark rail, subtle active pill, divider before settings).
3. **AI stays** in the same left column, **below** the menu stack, inside the current panel width.
4. **Coexistence with AI navigation:** if the user drives navigation via **manual menu**, the AI should not compete (no auto messages, no forced focus). If the user uses **AI to navigate** (e.g. tool calls or “go to …”), that **takes precedence** (router updates, optional brief acknowledgment in chat). Same panel: **one navigation authority at a time** — last explicit user action from either surface wins.

---

## 2. Information architecture (menu → route / content)

| Menu label (user-facing) | Maps to | Notes |
|--------------------------|---------|--------|
| **Ecosystem** | Space navigation / nested spaces | Today: aside route `…/select-navigation-action` (`NestedSpacesButton` + `PATH_SELECT_NAVIGATION_ACTION`). **Phase 3:** prefer **main-column** surface (per product request); may keep modal/aside as fallback during migration. |
| **Signals** | `coherence` tab | Renamed from **Coherence**; same route and page until split. **i18n:** new key (e.g. `Common.Signals`) + migration of tab copy. |
| **Proposals** | `agreements` tab | User-requested label; **i18n** rename from “Agreements” where this menu is used (URL segment can stay `agreements` for stability). |
| **Members** | `members` tab | Unchanged route. |
| **Treasury** | `treasury` tab | Core treasury only after Rewards extraction (Phase 2). |
| **Rewards** | New segment or hash | **Move** reward UI out of Treasury into its own **route** (e.g. `…/rewards` or `…/treasury/rewards` — pick one in Phase 2 and keep redirects). |
| **Memory** | New segment or tab under Signals | **Move** Space Memory out of Coherence page into **dedicated route** (e.g. `…/memory` or `…/coherence/memory`). Align with [space-memory-panel.md](../plans/space-memory-panel.md) and org-memory APIs. |
| **Space settings** | Existing settings path | **Wire** to current space settings entry (e.g. `…/agreements/space-configuration` or dedicated settings route — match `CompactSpaceBanner` / `getDhoPathAgreements(…)/space-configuration`). |

**Feature flags:** Respect `getEnableCoherence`, `getEnableSpaceMemory`, and any Treasury/Rewards flags already used in the app — hide or disable items rather than 404.

---

## 3. Design specification (world-class, system-aligned)

**Stack:** Radix + shadcn-style patterns in `packages/ui` (`Sidebar`, `SidebarMenu`, `SidebarGroup`, tokens). **Do not** fork a second sidebar system; compose **inside** the existing left `Sidebar`.

### 3.1 Visual language

- **Background:** `bg-sidebar` / `text-sidebar-foreground` (dark theme default).
- **Item height:** Comfortable 40–44px touch targets; **icon** 20px (`h-5 w-5`), **stroke** icons (Lucide) for consistency with references.
- **Active state:** Rounded rectangle (`rounded-md`), `bg-sidebar-accent` or subtle `bg-muted`, **not** full-width harsh contrast; **active** label `font-medium` + full opacity; inactive `text-sidebar-foreground/70`.
- **Collapse:** Reuse `collapsible="icon"` pattern from `packages/ui/src/sidebar.tsx` **if** the left `Sidebar` is switched from `offcanvas` to **icon rail**; otherwise implement **width sub-states** inside the panel: expanded (e.g. 320px with labels) vs **narrow icon rail** (e.g. 64–72px) using the same open/close entry point as today (sparkles / menu). **Chevron** `<<` in header to collapse labels only (panel can stay “open” with width change).
- **Separator** before **Space settings** (border-sidebar-border).
- **Scroll:** Menu + optional settings **fixed height flex**; **AI region** `flex-1 min-h-0 overflow-y-auto` so long chats scroll independently.

### 3.2 Accessibility

- **Nav:** `aria-label` on `<nav>` (“Space” or “Space navigation”).
- **Collapsed:** every icon button `title` + **Tooltip** + `aria-current="page"` on active route.
- **Keyboard:** Arrow keys optional enhancement; at minimum **Tab** through items and **Enter** to navigate.

### 3.3 Motion

- Width/label reveal **200ms** `ease-linear` to match `--sidebar-left-width` transitions in `PanelWrapLayout`; **prefers-reduced-motion** → instant or opacity-only.

---

## 4. AI / MCP behavior (precedence and “quiet” AI)

**Principle:** The left panel hosts **two affordances** (menu + chat) but **one navigation source of truth** (URL).

| Event | Expected behavior |
|--------|-------------------|
| User clicks a **menu** item | `next/link` navigation; **no** automatic AI message; optional **system** turn is **off** by default. |
| User sends a **chat** message that triggers **navigation** (tool or structured action) | **Router.push** to target; **AI** may show a **short** confirmation in thread. |
| **Conflicting** instruction | **Last explicit user action wins**; if chat navigates while user also clicked, **click** should win if it happened **after** the chat request (document event ordering in implementation). |
| **MCP / tools** | Reuse existing space-scoped tools; ensure tool results that change location **update the URL** and **left active state**; do not **duplicate** navigation in both chat and a second modal. |

**Implementation sketch:** small **client store** or context `SpaceNavIntent: 'manual' | 'ai' | null` set on menu click vs chat tool completion; **debounce** auto-suggestions when `manual` was set in the last N seconds (e.g. 30s) — product-tunable.

---

## 5. Phased delivery (ready for tickets)

### Phase 0 — Discovery and flags (no user-visible change)

**Completed inventory (living reference):**

| Surface | Location | Notes |
|--------|-----------|--------|
| Horizontal tabs | `apps/web/src/app/[lang]/dho/[id]/@tab/layout.tsx` → `NavigationTabs` | **md+** hidden; **`md:hidden`** horizontal tabs kept for mobile (`data-testid="dho-navigation-tabs-mobile"`) |
| Active segment | `packages/epics/src/common/get-active-tab-from-path.ts` | First segment after `/[lang]/dho/[id]/` |
| Path builders | `packages/epics/src/common/get-path-function.ts` (shared helpers), `@tab/*/constants` (duplicate paths — align over time) |
| Breadcrumbs | `apps/web/src/app/[lang]/dho/[id]/_components/breadcrumbs.tsx` | Independent of tabs |
| Aside deep links | `@aside/.../select-navigation-action`, `space-configuration`, etc. | Ecosystem / settings |
| E2E | `coherence.page.ts` (tab role), `coherence.spec.ts`, `coherence-chat-panel.*` | Update for **Signals** + left nav when testing desktop |
| Coherence flag | `getEnableCoherence()` (server) + `HYPHA_ENABLE_COHERENCE` cookie (client nav) | `SpaceLeftNav` hydrates cookie for parity with SSR |

**Treasury / Coherence split (for Phase 2+):** Treasury page can host **Rewards** UI today (extract in Phase 2). Coherence page hosts **Signals** + **Space Memory** (split per [space-memory-panel.md](../plans/space-memory-panel.md)).

**Ecosystem (Phase 3):** `NestedSpacesButton` → `…/select-navigation-action` aside; main-column route TBD (SEO: noindex on wizard-style routes if needed).

### Phase 1 — **Left menu mirrors the 4 existing tabs** (MVP in left panel)

**Scope:** Menu + labels + icons; **hide or stub** Ecosystem, Rewards, Memory, Space settings **or** link “coming soon” **disabled** state.

- [x] Add **`SpaceLeftNav`**: `packages/epics/src/common/space-left-nav.tsx` — `getActiveTabFromPath`, links via `get-path-function.ts`.
- [x] **`AiLeftPanelShell`** + **`ConnectedAiLeftPanelShell`** (`apps/web/src/components/connected-ai-left-panel-shell.tsx`) — **`SpaceNavIntentProvider`**, `getEnableCoherence()` passed server-side.
- [x] **Collapsible labels:** `localStorage` key **`hypha.leftNav.labelsExpanded`** (`1` / `0`); chevron toggles icon-only mode + tooltips.
- [x] **`NavigationTabs`:** **`md:hidden`** only (desktop uses left panel).
- [x] **i18n:** `Common.Signals`, `Common.Proposals`, **`SpaceLeftNav`** strings (all locales).
- [x] **Quiet AI:** `space-nav-intent-context.tsx` — manual nav sets **30s** cooldown; **`AiLeftPanel`** hides suggestion chips and ignores chip clicks during cooldown.
- [x] **QA:** `apps/web-e2e/src/space-left-nav.spec.ts` (AI panel + nav links); `coherence.spec` navigation group uses **mobile viewport** + **HYPHA_ENABLE_COHERENCE** cookie; `coherence.page` tab regex includes **Signals**.

**Exit criteria:** In space view, user can open the left panel and **navigate the four sections** from the **menu**; AI panel still works below; **no** duplicate tab row on desktop (unless mobile exception).

### Phase 2 — **Treasury: Rewards** + **Coherence: Memory** routes

- [ ] **Rewards:** extract from Treasury page into **dedicated route**; Treasury page links to Rewards; update **getActiveTabFromPath** / new helper if segment is `rewards`.
- [ ] **Memory:** extract from Coherence into **dedicated route**; **Signals** remain on Coherence **or** rename route segment to `signals` with **redirect** from `coherence` (301 / `next.config` or middleware).
- [ ] Add **left menu** items with feature flags; order: Ecosystem, Signals, Proposals, Members, Treasury, Rewards, Memory, [separator], Space settings.

### Phase 3 — **Ecosystem** on main panel

- [ ] Move **select navigation** from aside-only to **main column** route (e.g. `…/ecosystem` or `…/navigation`) reusing existing **aside** components where possible; update **Ecosystem** menu target.
- [ ] **Nested spaces** entry: align `NestedSpacesButton` with new flow (or **deprecate** in favor of Ecosystem menu).

### Phase 4 — Hardening and **URL / i18n** cleanup

- [ ] Optional: rename URL segments (`agreements` → `proposals`) with **redirects** and E2E coverage.
- [ ] **Performance:** Menus are **client**; prefetch `Link` for **hover** on desktop.
- [ ] **Analytics** (if applicable): **nav** click events vs **AI** navigation events.

---

## 6. Engineering tasks (condensed checklist)

- [ ] `PanelWrapLayout` / left slot: wrapper component **SpaceContextLeftPanel** = **nav** + **AiLeftPanel** (props or children).
- [ ] `getActiveTabFromPath` (or `getSpaceNavFromPath`) **extend** for `rewards`, `memory`, `ecosystem`.
- [ ] `next-intl` message files: **Signals**, **Proposals**, **Ecosystem**, **Rewards**, **Memory**, **Space settings** (where missing).
- [ ] E2E: `human-chat-panel` + new **`space-left-nav.spec.ts`** (open panel, click each item, assert URL).
- [ ] **MCP / chat:** document in [chat-ai-*.md](../requirements/) that tools **must** respect URL as source of truth (cross-link from this doc).

---

## 7. Non-goals (this PR / spec)

- Changing **right** Human chat panel layout.
- Replacing **MenuTop** global navies navigation.
- **Full redesign** of Treasury or Coherence **content** — only **navigation shell** and **route splits** as listed.

---

## 8. QA matrix (Phase 1 minimum)

| Case | Expect |
|------|--------|
| Open left panel | Menu visible above AI; sparkles trigger unchanged |
| Collapse labels | Icons only; tooltips show full names |
| Each of 4 tabs | Active highlight matches URL |
| `getEnableCoherence()` false | Signals hidden |
| Deep link to `…/treasury` | Correct active state when panel opens |
| AI send message | No automatic route change unless tool navigates |

---

**Document owner:** Engineering + Design. **Living doc:** update when route segments or flags change.
