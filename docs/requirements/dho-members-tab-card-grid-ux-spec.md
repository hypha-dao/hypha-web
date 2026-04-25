# UX / IA Specification — DHO **Members** tab: from vertical list to compact **card grid** (with space data)

## Document control

| Field            | Value                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Implemented in app (Members tab grid; see `MembersList`, `MemberCard`, `SpaceMemberCard`)                                                                                             |
| **Scope**        | DHO space **Members** main column: `@tab/members` → `MembersSection` + `MembersList` (`packages/epics/src/people/`)                                                                   |
| **Depends on**   | [Hypha UI stack](../../.agents/skills/hypha-ui-stack/SKILL.md) — tokens, shadcn/Radix, `packages/ui`                                                                                  |
| **Out of scope** | API contract changes (unless product approves a follow-up); person profile aside redesign; non-DHO members surfaces (e.g. side-panel member pickers) unless explicitly extended later |

---

## 1) Problem and intent

### 1.1 As-is (baseline)

- **Layout:** `MembersList` renders a **full-width column** of `MemberCard` / `SpaceMemberCard` rows, each a **tall, stacked** `Card` (`p-5`, `mb-2`, vertical `flex` blocks). Person and nested-space results share one scroll, interleaved in API order.
- **Data source:** `GET /api/v1/spaces/{spaceSlug}/members` returns paginated **`persons`** and **`spaces`** (see `getSpaceMembersForHttpApi`). Client: `useMembers` in `apps/web/src/hooks/use-members.ts` → `useMembersSection` for search + “load more” pages.
- **Per-person surface today:** `MemberCard` already surfaces **name, surname, nickname, avatar, status** (`StatusBadge`), **location**, **delegate / undelegate** when applicable, **joined date** (from `useEvents` join), **“Member”** outline badge, delegated-voting callout. Hard-coded English in a few CTA strings (debt; not repeated here).
- **Per-nested-space surface today:** `SpaceMemberCard` shows **logo, title, description**, **“Space”** badge, **join event date**, **delegate** mini-block (delegator avatar + name) via `useSpaceDelegate`.

The experience reads as a **line of full-width promos** rather than a scannable **directory**—especially when the roster is long.

### 1.2 Target experience

- **Visual pattern:** shift from a **single vertical “track” of wide cards** to a **responsive grid of compact member cards** (and a **visually related but distinct** card variant for **nested space** rows), **harmonized** in spacing, type scale, and treatment with the DHO main column and existing cards elsewhere.
- **Information design:** use **all stable roster data** the UI can already access (and clearly separate **primary** / **secondary** / **tertiary** so the grid stays **dense, no fluff**). Where copy would repeat the page context, **omit** (e.g. verbose section intros).
- **“World-class” bar:** one **clear focal point** per cell (identity), **at most two lines of secondary** metadata, **tertiary** (e.g. long date, long description) behind **hover**, **disclosure**, or **truncation** with accessible fallbacks.
- **Future: badges (reserved space):** layout must **book a non-collapsing row** (or end-cap slot) for **badges to ship soon** without reflow. **No badge pixels** in the first implementation pass—**placeholder / min-height + `aria-hidden` region** or design-token gap only, per engineering preference.

---

## 2) Role lenses

- **UI/UX (design engineering)**

  - Define a **tight cell grid** (gaps, min/max width, `aspect` / min-height) aligned to the design system.
  - Unify **person** vs **nested space** so they **share one grid** but remain **instantly distinguishable** (type label, avatar shape, or subtle border accent—not only color).
  - Specify **skeletons** and **empty** that match the **final grid** (no layout shift when data arrives).

- **Fullstack / Next.js**

  - Prefer **composition**: refactor `MemberCard` / `SpaceMemberCard` (or a thin `MembersGrid` + `MemberCell` / `NestedSpaceCell`) without changing the **roster** API.
  - If **pagination** is page-based with duplicate risk across person/space arrays, keep **one scroll container**; document whether **interleaving order** is preserved or re-sorted in UI (product decision).
  - **i18n** for any new labels; fix remaining hard-coded strings in member actions as part of the same initiative if touched.

- **QA**
  - **Keyboard / SR:** every cell remains a **single** primary `Link` (or link wrapping a card with **no nested interactive** pitfalls); if secondary actions (undelegate) remain, they must be **real buttons** with `stopPropagation` and **name** in locale.
  - **Viewports:** `sm` / `md` / `lg` column counts; no horizontal scroll on the main column.
  - **Loading:** grid skeleton count matches final columns; “load more” does not break focus.

---

## 3) Data map (use what we have, organize it)

The HTTP roster exposes **person** and **space** items (plus pagination). Implementations should map available fields to tiers below; **do not** invent fields—if something is missing, it stays out until API extends.

### 3.1 Person row (`MemberCard` props + hooks)

| Tier                  | Data                                                                               | Show in card                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 (identity)**     | `avatarUrl`, `name` + `surname`, `nickname`                                        | One **title line** (given + family, truncated); **@nickname** on second line or subline; avatar at fixed size.                          |
| **P1 (role / state)** | `status` (StatusBadge), on-chain **delegate** state, **“Member”** (or future role) | **Reserved badge row** (see §4.4) + one compact status if space allows.                                                                 |
| **P2 (context)**      | `location`                                                                         | **Icon + short** text; **truncate**; full string in `title` if needed.                                                                  |
| **P2 (provenance)**   | `join` event from `useEvents` (`joinedSpaceOn`)                                    | **One short line** (date **medium** or relative—product picks **one** convention; avoid long numeric time unless locale demands).       |
| **P3 (actions)**      | `undelegate` CTA, `address`                                                        | **Icon button** or **tertiary text button** in footer; keep **one** action visible; overflow to menu only if we add more actions later. |

Omit from the default cell body: long **about** text (if surfaced later, **bio line** with clamp + `title` or profile link only).

### 3.2 Nested space row (`space` from roster)

| Tier     | Data                                      | Show in card                                                                                                                               |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0**   | `title`, `logoUrl`, `slug`                | **Title** + lead image/ logo; type chip **“Space”** (i18n).                                                                                |
| **P1**   | `description`                             | **One line** clamp; full in `title` on hover.                                                                                              |
| **P2**   | `join` event, `address` (for event match) | Same date treatment as people.                                                                                                             |
| **P1–2** | **Delegate** (delegator person)           | **One compact row**: small avatar + short name; link target unchanged (`/{lang}/dho/{space.slug}/agreements` from current implementation). |

### 3.3 Contextual space (current DHO)

From `useSpaceBySlug` (for permissions, not duplicated per cell): `web3SpaceId`, membership, delegate—used for **CTA gating** (delegate voting in toolbar), **not** re-printed in every cell unless product wants a “You” marker for the current user (optional future).

---

## 4) Layout and visual system

### 4.1 Grid

- **Container:** `w-full` inside the existing `MembersSection` content width; **same horizontal padding** as other DHO tab bodies (`py-4` column pattern).
- **Columns (suggested):**
  - **default:** 1 col `< sm`
  - `sm:` 2 cols
  - `lg:` 3 cols (or 4 if `min-w` of cell ≥ ~220px and content still works—validate in design QA)
- **Gap:** one scale step from the design system (e.g. `gap-3` or `gap-4`); **no** extra section wrappers that add double vertical padding between toolbar and grid.
- **Row height:** **target a uniform minimum height** for person cells so the grid is **gridded**, not ragged. Multi-line **delegate** or **date** can use **clamped 2 lines max** in-cell or push to a **second row inside the same card** with strict `max-h`.

### 4.2 Card structure (unified)

Each cell: **`Card` or bordered surface** with:

1. **Header strip:** avatar / logo (left) + type indicator (right or under title).
2. **Title block** (2 lines max for identity).
3. **Reserved row** for **badges** (§4.4).
4. **Metadata strip** (location, date)—single line, **`text-muted-foreground`**, `truncate`.
5. **Optional footer** for one primary **secondary action** (undelegate) aligned **end** or full-width **ghost** button for touch.

**Nested space** reuses the same **footprint** but swaps avatar → **round/squircle logo**, title → space title, metadata → description/join; **do not** reuse “Member” badge for spaces.

### 4.3 Harmonisation

- **Typography:** align title to **`text-4` / `text-3`** scale used on `DocumentSection` / DHO; secondary **`text-1` / `text-2`**.
- **Colour:** `muted-foreground` for non-primary; **accent** only for interactive and type chips.
- **Motion:** optional **subtle hover** (border / shadow) **≤ 150ms**; **`prefers-reduced-motion: reduce`** = opacity or none.

### 4.4 Badge reservation (upcoming, not shown)

- **Requirement:** a **dedicated row** (or end-aligned area of fixed min-height, e.g. `min-h-[1.5rem] md:min-h-5`) below the title block, **left-to-right** flex with `gap-1.5` / `flex-wrap` cap **max 2 lines**; **empty** in v1.
- **A11y:** the reserved container may use **`aria-hidden="true"`** until real badges exist, _or_ omit from accessibility tree with **no** live text; ensure **no** empty `aria-label`.
- **Rationale:** avoids cramping when badges land (roles, status pills, “Verified”, etc.).

### 4.5 Toolbar (above grid)

- Keep **one** `SectionFilter` row: count + **Members** label + search; **actions** (Exit space, Delegate voting) stay **on the same row** or **row below on narrow** to avoid cramping; **no duplicate headings**.

---

## 5) Interactions and navigation (unchanged contracts)

- **Person click:** `Link` to `basePath/{person.slug}` with `scroll: false` (as today).
- **Space click:** `Link` to `/{lang}/dho/{space.slug}/agreements` (as today).
- **Delegate CTA in card:** if retained, must **not** fire navigation from the parent link; use **`preventDefault` / `stopPropagation`**, or restructure to **card without wrapping `<Link>`** and use **separate** hit targets (link area vs button)—prefer **one link + button** pattern with valid HTML (no `button` inside `a`).

---

## 6) Implementation notes (for the engineering pass)

- **Refactor over rewrite:** extract presentation into **`MemberCell`** / **`NestedSpaceCell`** or props-driven **`MemberCard` `variant="grid|legacy"`** to allow reuse in asides.
- **`minimize` prop** on `MemberCard` is unused in `MembersList` today; either **use it** to mean “compact” or **remove** after migration to avoid dead API surface.
- **Pagination:** `useMembersSection` composes `total` from `persons` + `spaces` pagination; confirm **load more** fetches the **next page** for the **combined** query in a way that **matches backend ordering** (document in code if backend defines sort).
- **Empty / zero:** a single **empty state** in the content area, not many cards.

---

## 7) QA checklist (for implementation PR)

| #   | Check                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Grid: 1 / 2 / 3(–4) columns at agreed breakpoints; no layout jump after load.                                                                                 |
| 2   | Person vs space: distinguishable in **grayscale** (not color-only).                                                                                           |
| 3   | Truncation: long name / description have **`title` tooltip** or equivalent for pointer users; screen readers get full string in accessible name if truncated. |
| 4   | Badge row: **reserved height**; no content overlap when simulating 2–3 future badges in dev.                                                                  |
| 5   | `prefers-reduced-motion` respected.                                                                                                                           |
| 6   | Keyboard: tab order logical; no focus trap in grid.                                                                                                           |
| 7   | E2E: update selectors that targeted **row-only** `member-list` if classnames/DOM change.                                                                      |

---

## 8) Open questions (product / design)

1. **Interleaving:** should **all people** list first, then **all nested spaces**, or **strict API order**? (Affects scanning and “directory” mental model.)
2. **Date format:** **relative** (“3 days ago”) vs **short absolute** (locale) for join?
3. **Delegate CTA in cell:** keep **inline** on grid or **move to profile only** to maximize density?
4. **Maximum columns at `2xl`:** 3 or 4?

---

## 9) Traceability

| Code anchor                                                  | Purpose                        |
| ------------------------------------------------------------ | ------------------------------ |
| `packages/epics/src/people/components/members-section.tsx`   | Page composition, toolbar      |
| `packages/epics/src/people/components/members-list.tsx`      | Renders list + `Link` wrappers |
| `packages/epics/src/people/components/member-card.tsx`       | Person cell                    |
| `packages/epics/src/people/components/space-member-card.tsx` | Nested space cell              |
| `GET /api/v1/spaces/[spaceSlug]/members`                     | Roster source                  |

---

_This document is a UX/IA and implementation-facing specification; it does not ship UI by itself._
