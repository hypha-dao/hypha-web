# UX / IA Specification — DHO **Ecosystem** (formerly “Spaces”): full-bleed map, “wow,” and **above-the-fold** data

## Document control

| Field                                  | Value                                                                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                             | Implemented in app: Ecosystem **label** + split **map** / **data** layout + full-bleed + `/ecosystem` → `/spaces` redirect. Ambient “wow” = gradient mesh; further polish optional. |
| **Scope**                              | DHO space main column: `@tab/spaces` → `SpaceNavigationView`, `SpaceVisualization`, `VisibleSpacesList`, **left rail** item currently labeled **Spaces** (`Common.Spaces`)          |
| **Depends on**                         | [Hypha UI stack](../../.agents/skills/hypha-ui-stack/SKILL.md); [dho-central-left-nav-and-space-graph-tech-spec.md](./dho-central-left-nav-and-space-graph-tech-spec.md)            |
| **Out of scope (this spec iteration)** | Finishing **Space-to-Space** and **Values Flows** tab content (remain placeholders or “coming soon” until a dedicated initiative); API changes to org graph data                    |

---

## 1) Product intent

### 1.1 Naming and mental model

- The left-rail item and any primary UI copy for this area should use **Ecosystem** (not “Spaces” alone) to signal **the living map of relationships**—nested spaces, future flows—not just a list of rooms.
- **URL** may remain `/spaces` for stability and existing links, **or** migrate to `/ecosystem` with redirects—**decide in implementation** (see §6.1). User-facing label is **Ecosystem** regardless.

### 1.2 “Opening screen” (default first view in a space)

- **Intent:** When a user lands in a DHO **space** context, the product should feel like the **Ecosystem** is a **first-class home** for orientation—at least for users who care about structure (not only agreements).
- **Default route today:** Per [dho-workspace-nav-phases-0-6.md](./dho-workspace-nav-phases-0-6.md), default tab is **`/agreements`**. This spec **does not mandate** a global default change without product sign-off, but it **recommends** an explicit choice:
  - **Option A —** Keep default `agreements`; **Ecosystem** is one click away (low risk).
  - **Option B —** Default new sessions to **`/spaces` (Ecosystem)** for a more “map-first” DAO experience (higher impact; needs analytics and onboarding).
  - **Option C —** Per-user or per-space preference (later).

**Recommendation for “best in class” discovery:** test **B** on staging with a feature flag, or ship **A** and deep-link marketing to Ecosystem.

### 1.3 The problem to solve (current UX)

- The **nested map** (`SpaceVisualization`) lives inside a **visually heavy tab panel** (`Tabs` with padded, rounded container) and a **constrained** map region; the experience reads as a **widget in a box** rather than an **immersive canvas**.
- **Search, root card, and list** sit **below** the diagram in the scroll order, so on typical laptop viewports they are **not above the fold** without scrolling.
- The product needs **“wow”** (memorable, premium) **without** sacrificing **performance, a11y, or `prefers-reduced-motion`**.

---

## 2) Design principles (team lenses)

### 2.1 UI/UX (design engineering)

- **Immersive canvas** — The graph is **not** a card-in-card. It should **breathe** in the main column: **edge-to-edge** (respecting the same horizontal rhythm as other DHO tabs), **full intended height** in the viewport, and **one** clear focal hierarchy: **tabs → map → supporting data**, with **data accessible without hunting below the map** (see §4).
- **Wow, bounded** — Use **one** strong signature: e.g. **subtle animated mesh / gradient** in the background, **soft vignette**, **parallax or slow drift** on the map container (optional), **entry** animation for nodes on first paint (stagger, opacity). **No** infinite spinning chrome; **no** essential information only in motion.
- **Above the fold** — On **1280×800** and **1440×900** (common “work” viewports), the user should see **without scroll**: tab strip, **at least 50–60%** of the map height intent, and **either** the **search + first row of data** or a **clear “Data” strip** (see §4.2). On **mobile**, prioritize **search + current space / root card** then **list**; map may be **shorter** with **pinch/pan** documented.

### 2.2 Fullstack / Next.js

- **Layout composition** — Refactor `SpaceNavigationView` so the **map** is not wrapped in unnecessary **nested backgrounds**; remove or repurpose the **boxed** `Tabs` container (`bg-primary-foreground` + `p-4` + rounded) in favor of **full-width** tab triggers with **content** that can use **`min-h-[dvh]`** semantics minus **header chrome** (sticky DHO space banner + rail offsets).
- **Dynamic import** — Keep `SpaceVisualization` as **`next/dynamic` `ssr: false`** where needed, but the **skeleton** must **match the final** full-bleed **aspect** to avoid **CLS** (Cumulative Layout Shift).
- **State** — Tab state **Nested Spaces | Space-to-Space | Values Flows** **remains**; only **Nested Spaces** is fully spec’d for layout here; other tabs keep **existing** “coming soon” or minimal placeholders until a later ticket.

### 2.3 QA

- **Keyboard** — Tabs are **Roving tabindex** (Radix); map must expose **name** and **current space** in SR where the library allows (if canvas-only, add **landmark** + off-screen summary).
- **Axe** — Re-scan `dho-space-navigation-view` after layout changes; **contrast** on tab triggers over new background.
- **Viewports** — E2E **above-the-fold** assertion: e.g. **search input** or **`data-testid` list header** in **viewport** at `page.setViewportSize({ width: 1280, height: 800 })` (tune with design).
- **Motion** — `prefers-reduced-motion: reduce` → **disable** parallax, stagger, and ambient loop; show **static** map + static background.

---

## 3) Information architecture — Nested Spaces tab

### 3.1 Content blocks (in priority order for scanning)

1. **Section identity** (optional, compact) — Short title **“Ecosystem”** + one-line value prop; avoid repeating the long `SelectNavigationAction` essay if the **sticky space banner** already orients the user. Prefer **tighter** `SelectAction` or move long copy to **? help** / docs link.
2. **Tabs** (fixed scope) — **Nested Spaces | Space-to-Space | Values Flows** — same labels/i18n keys, possibly rename tab strings for consistency (“Nested spaces” etc.).
3. **Primary canvas** — **SpaceVisualization** (d3) — full width, **minimum height** tied to viewport (§4.1), **no** inner “grey TV frame” unless it is a **1px** hairline or **very subtle** depth—**not** a second card.
4. **Data strip (above the fold goal)** — **Search** + **high-signal list / cards** (e.g. root row, `VisibleSpacesList` entries) placed so they are **visible on first paint** on target viewports.
5. **Deep content** — Anything secondary (e.g. long lists) scrolls; **load more** if present.

### 3.2 What “remove from its box” means (normative)

- **Do not** wrap the visualization in a **rounded rectangle** with large padding that shrinks the chart below a **“portal”** feeling.
- **Do** use **optional** full-bleed **background layer** (gradient / noise) **behind** the entire tab content **or** only behind the map row—**one** design decision, not both competing.
- The **TabsList** can sit **on** the background (sticky optional) with **increased** contrast (blur / scrim) so it remains readable over imagery.

---

## 4) Layout: full vertical visibility + “above the fold” data

### 4.1 Map height (the “entirely vertically” requirement)

- **Target:** On desktop, the map region should use **most of the viewport** below the sticky DHO header + (if present) space chrome, so the **hierarchy** reads as a **main stage**, not a thumbnail.
- **Concrete approach (choose one in implementation, document the pick):**
  - **A — Viewport-bounded** — `min-h: calc(100dvh - <measured offset>)` for the **map row only**, with `overflow: hidden` on the canvas and **inner** pan/zoom (if the viz supports it) OR **fit-to-view** scaling so **no vertical crop** of the “world” (may require d3 `fit` recalculation on resize).
  - **B — Split view** — **Top ~45–50%** viewport: map; **bottom**: sticky “data deck” (search + list) with `max-h` and internal scroll, so **data** is always **visible** while map stays in view. Strong for **above-the-fold**; slightly less “one canvas.”
  - **C — Stacked with scroll snap** — Full-height map, **snap point** to data on first scroll; **data** also duplicated in a **collapsible** bar—riskier; use only if A/B can’t meet fold goals.

**Recommendation:** **B** for fastest path to “above the fold + wow map,” or **A** if d3 can **true-scale** the tree to available height (verify with `SpaceVisualization` implementation).

### 4.2 Placing data above the fold

- **Minimum** — On **1280×800**, user sees **search** + **at least** the “current / root” row **and** the **first list row** (or 2 compact cards) **without** scrolling the **page** (list may have **internal** scroll for overflow).
- **Order options:**
  1. **Data-first** — Search + compact cards **first**, then map (sacrifices “map first”—usually wrong for this screen).
  2. **Split** — **Side-by-side** on `lg+`: map **left** (60–65%), **data** **right** (35–40%) with search top; on `md-` stack map then data (fold behavior documented).
  3. **Overlay strip** — Thin **docked** search at bottom of map (over gradient scrim) + list slides up—higher build cost; impressive if done well.

**Recommendation for best-in-class:** **Split on desktop** (2) and **stack with tight map height** (4.1-B) on small screens.

### 4.3 Wow effects (curated, token-safe)

- **Background:** `neutral` / `accent` gradient **mesh** (CSS or canvas), **2–3%** opacity lines, **dark-mode** tuned; **no** text over busy areas without **scrim**.
- **Map entry:** Staggered **fade+scale** of nodes (cap **300ms** total, **stagger 30–50ms**), or **one** elegant **cinematic** fade of the whole SVG. **`prefers-reduced-motion`:** instant.
- **Micro-interaction:** Hover on node → **glow** ring (token: `ring-accent/40`), **cursor** `grab` if pannable.
- **Ambient (optional, off by default):** **Very slow** drift of background (30–60s loop)—**disabled** when `prefers-reduced-motion` or `save-data` hint if implemented.

### 4.4 Performance budgets

- **LCP/CLS** — Reserve **skeleton** with the **final** min-height; **no** layout jump when d3 loads.
- **D3** — Throttle `resize` observers; **cancel** animations on unmount; avoid **double** `requestAnimationFrame` chains without guards.

---

## 5) Navigation label: Ecosystem

- **User-visible** — `Common` (or DHO-specific namespace) new key **`Ecosystem`** with full locale set; keep **`Spaces` string** for backward compatibility in **non-nav** copy if still needed, or **migrate** with translator notes.
- **i18n** — Update all **nav** and **breadcrumbs** that used “Spaces” for this **route** to **Ecosystem**; audit `SelectNavigationAction` title if it still says “Space Navigation.”
- **E2E** — `data-testid` `dho-workspace-nav-spaces` may keep **name** (segment) but **text** assert becomes **Ecosystem** / localized equivalent.

---

## 6) Engineering follow-ups (non-normative checklist)

| Area                     | Note                                                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **URL**                  | If renaming route to `/ecosystem`, add **redirect** from `/spaces` + middleware; update `getDhoPathSpaces` / `getActiveTabFromPath` and any deep links.                                             |
| **Default tab**          | If product picks **B** (§1.2), change default redirect for `/[lang]/dho/[id]` to **`spaces`**/ecosystem segment with flag.                                                                          |
| **SelectAction**         | Tighten **intro copy**; avoid pushing map below the fold.                                                                                                                                           |
| **SpaceVisualization**   | May need **props** for `className` / `fit: 'viewport'                                                                                                                                               | 'width'`; confirm with file `apps/web/.../space-visualization.tsx`. |
| **visibleSpaces + list** | Ensure `VisibleSpacesList` layout matches **grid spec** in [dho-members-tab-card-grid-ux-spec.md](./dho-members-tab-card-grid-ux-spec.md) **only where applicable**; avoid duplicate card language. |

---

## 7) QA matrix (implementation pass)

| #   | Check                                                                 | Notes                       |
| --- | --------------------------------------------------------------------- | --------------------------- |
| 1   | Ecosystem **label** in **nav** and **head** where applicable          | All 5 locales               |
| 2   | **Above-the-fold** search (or data strip) in viewport at **1280×800** | Playwright                  |
| 3   | **No** inner “box” strangling the map (visual)                        | Screenshot / design review  |
| 4   | **Full vertical** intent: map not clipped to ~400px                   | Compare to old              |
| 5   | **Tabs** work; other tabs show existing placeholder                   | Regression                  |
| 6   | `prefers-reduced-motion`                                              | No ambient motion           |
| 7   | **a11y**                                                              | Tabs + landmark for section |

---

## 8) Traceability (code)

| File                                             | Relevance                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `apps/web/.../dho-space-workspace.tsx`           | Nav item label, `getDhoPathSpaces` href                            |
| `apps/web/.../space-navigation-view.tsx`         | Tabs, layout, order of `SpaceVisualization` vs `VisibleSpacesList` |
| `apps/web/.../space-visualization.tsx`           | Sizing, fit, margins                                               |
| `apps/web/.../visible-spaces-list.tsx`           | List / search placement                                            |
| `packages/epics/.../get-active-tab-from-path.ts` | If segment rename                                                  |

---

## 9) Open design decisions (resolve before build)

1. **Split** vs **stacked** for map + data (§4.2) — which pattern for v1?
2. **URL** keep `/spaces` or introduce `/ecosystem`?
3. **Default tab** for `/dho/[id]` — agreements vs ecosystem (flagged)?
4. **Helping users who want Agreements first** — if default shifts, add **banner** CTA?

---

_This document is a UX/IA specification for a follow-up implementation; it does not ship code by itself._
