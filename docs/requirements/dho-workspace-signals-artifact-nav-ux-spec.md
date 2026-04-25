# UX / IA Specification — DHO workspace nav: **Signals**, **Artifact**, icon-first rail, and title alignment

## Document control

| Field            | Value                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Superseded for nav: **Wiki** (`/wiki`) + `SpaceMemorySection`; legacy `/artifact` redirects to `/wiki`. This file remains historical IA for Signals/icon rail. |
| **Scope**        | Central left rail in the DHO space workspace (`DhoSpaceWorkspace`) and related content column chrome                                                           |
| **Depends on**   | [dho-central-left-nav-and-space-graph-tech-spec.md](./dho-central-left-nav-and-space-graph-tech-spec.md) (layout, routes, `PanelWrapLayout` coupling)          |
| **Out of scope** | Rebuilding Coherence/Signals data services, org-memory APIs, or three-pane (AI / main / human chat) product chrome beyond the central column                   |

## 1) Problem (from product + design review)

1. **Visual alignment** — The first item in the left rail (today **Coherence** when enabled) sits **optically below** the first line of the main column title (e.g. section headers such as _On voting_ in Agreements). The target is **one horizontal reading line**: the cap height of the first nav row aligns with the cap height of the primary page heading in the main column (not necessarily the sticky banner, unless product locks that as the “title” — see §3).
2. **Naming** — **Coherence** is renamed to **Signals** for the nav and primary mental model. **Space memory** (today often buried in the Coherence experience) is elevated as **Artifact** in the nav.
3. **Icon-first IA** — The rail should feel **world-class**: **icons are the primary affordance**; text labels are secondary and can be **progressively revealed** (viewport, density, or explicit user preference — see §4).
4. **Artifact as its own place** — Users need a **dedicated entry** in the same rail (not only an in-page subsection), with clear routing and state, while reusing existing Space Memory capabilities where possible.

---

## 2) Role lenses (how we will validate the spec)

- **UI/UX (design engineering)**

  - Establish **optical alignment** rules (type metrics, not arbitrary pixel nudging).
  - Define an **icon system** (metaphor, size, weight, color states) that matches `packages/ui` + Hypha tokens ([Hypha UI stack](../../.agents/skills/hypha-ui-stack/SKILL.md)).
  - Specify **reduced motion** and **contrast** so “wow” never sacrifices WCAG 2.1 AA.

- **Fullstack / Next.js**

  - Preserve **stable URL contracts** where they already exist; introduce **first-class routes** for anything that becomes a top-level nav item.
  - Keep **`getActiveTabFromPath`**, middleware, and parallel `@tab` routes coherent when adding a new segment.
  - **i18n**: all new strings via `next-intl` (no hard-coded English in components).

- **QA**
  - **Visual + DOM** checks: rail first row vs main heading **baseline/ cap alignment** at `md+`.
  - **Keyboard / SR**: nav remains a real `<nav>` with list semantics; current item `aria-current="page"`; **icons** are `aria-hidden` with visible text _or_ accessible names on the control.
  - **Flags**: `getEnableCoherence()` / `getEnableSpaceMemory()` (and related build-time flags) — nav items appear/disappear and deep links **redirect** consistently when disabled.
  - **Playwright** ([e2e-testing](../../.agents/skills/e2e-testing/SKILL.md)): update selectors that key off `"Coherence"` copy or `coherence` nav name once implementation lands.

---

## 3) Alignment spec — rail vs main column title

### 3.1 Intent

**The first line of the primary navigation must align to the first line of the primary content title** in the main column, so the workspace reads as a single **horizontal “header band”** across rail + content.

“Primary content title” **defaults to** the first **visible** `h1` / `PageTitle` (or product-equivalent) in the main column for the active tab. If a tab uses a **sub-header** (e.g. a filter bar) _above_ the H1, alignment is still to the **H1**, not the sub-header.

### 3.2 Avoided failure modes

- **Padding mismatch** — different `padding-top` on the rail column vs the `children` wrapper.
- **Title inside a card** — if the H1 is inset inside a card with its own `padding-top`, the spec still targets **H1 cap alignment**, not the card container top (may require shared top spacing tokens).
- **Sticky chrome** — `DhoStickySpaceChrome` and banners may **not** share the same top offset as the rail; the alignment reference is the **in-flow** title, not the sticky bar, unless product explicitly chooses “align to banner bottom” (documented decision in implementation).

### 3.3 Measurement (QA-ready)

- **Desktop (`md+`)** — In a default Agreements view (or a reference page with a long title such as _On voting_), the **top of the em-square / cap height** of the first nav label (or icon) **Y** position must match the **cap height** of the main column H1 within **±1px** at 1x DPR (allow **±2px** if font subsampling differs across browsers; document the tolerance).
- **Mobile** — The sheet / floating menu does not require this same rail vs title metric; it keeps **touch targets ≥ 44px** and **safe area** insets (existing spec).

### 3.4 Design tokens (implementation-agnostic)

- One **shared vertical offset token** (or the same `padding-top` / `scroll-margin` pair) applied to:
  - the **start of the nav list** (not necessarily the whole `<nav>` if the nav has an inner label region later), and
  - the **start of the main title column** (or a wrapper that contains only title + actions).
- Prefer **flex** alignment (`items-start` + explicit `pt-*` parity) over one-off `translate-y` nudges.

---

## 4) Naming & information architecture

### 4.1 “Coherence” → **Signals**

- **User-facing** label: **Signals** (all locales; new or updated `next-intl` keys with translator context: _“Navigation item: signals, coherence, DAO alignment”_).
- **Engineering** — The existing URL segment `coherence` may **remain** for backward compatibility and analytics continuity; the **nav label and any heading copy** use **Signals**. If marketing/legal requires a URL change later, that is a **separate, migration-gated** task (301 map, e2e, external links).
- **Order** (when Coherence/Signals is enabled) — **Signals** stays **first** in the group (per [dho-workspace-nav-phases-0-6.md](./dho-workspace-nav-phases-0-6.md) and product wireframe: Signals at top). Full order with Artifact is in §4.3.

### 4.2 “Space memory” → **Artifact**

- **User-facing** label: **Artifact** (not “Artifacts” unless product explicitly pluralizes in English; wireframe copy says **Artifact** for the book metaphor).
- **Concept** — A dedicated place for the **org / space memory timeline** and related content currently gated by `getEnableSpaceMemory()` and rendered inside the Coherence flow (`SpaceMemorySection` et al. in `packages/epics`).

### 4.3 Recommended nav order (desktop + same order in mobile sheet)

When each feature is **on**:

1. **Signals** (`getEnableCoherence()`)
2. **Agreements**
3. **Members**
4. **Treasury**
5. **Artifact** (`getEnableSpaceMemory()`) — _new top-level item_
6. **Spaces** (graph — existing `Common.Spaces` or product-approved copy)

When a flag is off, that item is **omitted**; the list collapses with **no placeholder gaps**.

**Open point (product)** — If both Signals and Artifact are on, should **Artifact** sit **immediately after Signals** (group “understanding & memory” together) or stay **before Spaces** as above? The table reflects the **wireframe ordering**; adjust after stakeholder review.

---

## 5) Icon-first rail — visual & interaction spec

### 5.1 Metaphor (wireframe-aligned)

| Nav item       | Icon metaphor                                   | Notes                                                                                                          |
| -------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Signals**    | Broadcast / signal radiating (e.g. radio waves) | Replaces “sparkle only” if product wants stronger _signal_ semantics; must stay distinct from _notifications_. |
| **Agreements** | Document / list with check (ballot)             | Aligned to voting / proposals context.                                                                         |
| **Members**    | People / avatars                                | Three-person silhouette pattern is acceptable.                                                                 |
| **Treasury**   | Vault / safe / treasury                         |                                                                                                                |
| **Artifact**   | Open book, scroll, or stacked layers            | Chosen for “memory as curated record”; avoid conflating with _files_ (upload).                                 |
| **Spaces**     | Grid / map / small multiples                    | Can reuse or refine current `LayoutGrid` usage.                                                                |

**Source of truth for stroke / corner radius** — Lucide-style **24px default** in rail, 1.5px stroke, rounded caps, or **custom SVGs** in the same optical weight as Lucide. No mixed weights between items.

### 5.2 Icon-first, text optional (progressive disclosure)

- **Default (md+)** — Each row: **icon + label** in one hit target, with **icon leading**; label can use **one line** with ellipsis at narrow widths.
- **“Compact / icons-first”** (the “wow” density mode) — **Icon-only** in the rail with **tooltip** (`Tooltip` from `packages/ui` / Radix) on **hover and focus** showing the full name; must remain **fully usable** for power users.
- **“Extended labels”** (explicit preference) — **Always show full labels** (accessibility, onboarding). Implementation options: a **user preference** in account/settings, a **local toggle** in the nav footer, or **system / breakpoint** (e.g. `xl` always shows text). The spec **does not** mandate which storage — only that the **default** leans **icon-dominant** and **text is one click/gesture away** (tooltip or long-press on touch).

### 5.3 States (per item)

- **Default** — Muted neutral foreground; icon at ~70% emphasis vs label.
- **Hover** — Subtle `muted` background; no layout shift.
- **Active** — Distinct but calm: accent-tinted background (existing `bg-accent/15` family), **icon + text** at full foreground.
- **Focus** — Visible `ring-2` ring, offset; never rely on color alone.
- **Disabled** (if used for “coming soon”) — `opacity` + `aria-disabled`; avoid for primary items unless product requires.

### 5.4 Motion (“wow” within guardrails)

- **Enter** — Stagger **fade + 4–8px slide** on first paint (max **300ms** total, stagger **20–40ms** per item).
- **Active change** — **Underline or pill** morphs with **200ms** ease; respect `prefers-reduced-motion: reduce` (instant or opacity-only).
- **No** continuous looping animations in the rail; **no** mandatory parallax for navigation.

---

## 6) Artifact — routing & behavior (spec-level)

### 6.1 Requirement

**Artifact** must be a **first-class destination** in the DHO space workspace:

- Appears in the **left rail and mobile sheet** when `getEnableSpaceMemory()` is true.
- Has a **canonical URL** suitable for deep linking, sharing, and e2e stability.

### 6.2 Recommended approach (for implementation PR)

- Add a **new `@tab` parallel segment** (e.g. `artifact/`) with `page.tsx` that **hosts the same Space Memory UI** used today inside Coherence, without duplicating data-fetch logic (extract shared RSC or client if needed).
- Extend **`getActiveTabFromPath`** / `KNOWN_DHO_TABS` to include `artifact` (or a product-approved segment name).
- **Coherence/Signals page** may **retain** an optional inline entry to Space Memory (for migration) or **remove** the duplicate in favor of nav-only; product decides **one** primary path to avoid confusion (spec default: **Artifact nav only** once ship-ready).

### 6.3 When the flag is off

- **Nav item** hidden.
- Direct access to `/artifact` → **redirect** to default space tab (e.g. Agreements) or to Signals if coherence is on — same pattern as other gated tabs (mirror coherence redirect behavior).

---

## 7) Accessibility (normative summary)

- Icons **decorative** → `aria-hidden="true"` when **visible text** is on the same control.
- **Icon-only** mode → `aria-label` (i18n) on the `Link` / `Button`.
- **Tooltips** are not the sole carrier of name in icon-only mode: focusable elements still expose an **accessible name** via `aria-label` or `sr-only` text.
- **Color contrast** — Active, hover, and default states meet **4.5:1** for text; **3:1** for icon vs background where applicable.

---

## 8) QA matrix (execute when implementation lands)

| #   | Check                                                                   | Type                                                                  |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | First nav row cap-aligns to main H1 (§3)                                | Playwright: bounding box or screenshot comparison; manual spot-check. |
| 2   | All items route correctly; `aria-current` on current                    | E2E                                                                   |
| 3   | `Signals` copy and `artifact` segment; flags hide/show                  | E2E + unit for path helper                                            |
| 4   | Icon-only: focus shows tooltip/visible ring; screen reader name         | Manual + Axe (no duplicate names)                                     |
| 5   | `prefers-reduced-motion` — no stagger or instant                        | Manual / e2e env                                                      |
| 6   | Mobile sheet lists **Signals**, **Artifact**, other items in same order | E2E (narrow)                                                          |

---

## 9) Traceability to other docs

| Document                                                                                                 | Update                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [dho-central-left-nav-and-space-graph-tech-spec.md](./dho-central-left-nav-and-space-graph-tech-spec.md) | Add pointer to this spec; supersede “Coherence”/“Space Memory” phrasing in nav for future implementation passes.                                               |
| [dho-workspace-nav-phases-0-6.md](./dho-workspace-nav-phases-0-6.md)                                       | Add **follow-up** row: **Signals / Artifact / icon rail / title alignment** tracked in this document (does not re-open closed phases; adds product iteration). |

---

_This document is a UX/IA and engineering-facing specification only; it does not ship code._
