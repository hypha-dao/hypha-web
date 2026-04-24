# Technical specification — space whitelabel (logo, breadcrumb) and “AI Chat” copy

## Document control

| Field | Value |
|--------|--------|
| **Status** | Ready for implementation (planning) |
| **Scope** | Product chrome on **DHO / space** routes: header logo, breadcrumb hierarchy, left panel title copy; no backend schema change required unless a gap is found in root resolution |
| **Out of scope** | Changing Network / My spaces Hypha branding; i18n message updates beyond the listed keys (separate i18n task) |
| **Related code (reference)** | `apps/web/src/app/[lang]/dho/[id]/layout.tsx`, `apps/web/src/app/[lang]/dho/[id]/_components/breadcrumbs.tsx`, `apps/web/src/app/[lang]/dho/[id]/_components/dho-sticky-space-chrome.tsx`, `packages/epics/src/spaces/components/breadcrumbs.tsx` |

---

## 1) Problem statement

Ecosystems are modeled as **nested spaces**. Stakeholders want a **whitelabel feel** on the **space (DHO) view**: users should see their **ecosystem (root) identity**, not the Hypha app mark, in the same places they currently see a **single-space** avatar in the top chrome. They also need a **breadcrumb** that reads **from root through every parent** to the current space, left-to-right. The **left panel** label should read **“AI Chat”** instead of **“Hypha AI”** (copy is not product-branded in that panel).

**Explicit routing split**

| Context | Product Hypha logo (current behavior retained) |
|--------|-------------------------------------------------|
| Network, My spaces, and other **non–space-page** app chrome | **Yes** — keep Hypha logo (or current global branding) as today |
| **`/[lang]/dho/[slug]/…` space page** (and nested sub-routes under the same DHO layout) | **No** — use **root space** logo in the **sticky/header avatar slot** that today shows the *current* space only |

---

## 2) Definitions

- **Root space:** the topmost ancestor in the `parent_id` chain: walk from the **current** space row up until `parent_id` is null. That row is the **ecosystem root** for the current view.
- **Breadcrumb path:** ordered list of spaces from **root → … → current**, each with `slug` and `title` (or equivalent display name fields already used in UI).

---

## 3) Functional requirements

| ID | Requirement |
|----|-------------|
| **FR-1** | On **space (DHO) pages**, the **primary header/sticky logo** (the small avatar next to the breadcrumb row, currently fed from the **current** space’s `logoUrl` in `DhoLayout` / `DhoStickySpaceChrome`) **SHALL** use the **root space** `logoUrl` (with the same **safe image URL** rules and **default avatar** fallback as today when missing/invalid). |
| **FR-2** | On the same pages, the **CompactSpaceBanner** and other in-flow uses of the **current** space’s art (e.g. **hero**, **title**, **description**, member counts) **SHALL NOT** change — only the **global/sticky** slot described in FR-1 switches to the root logo for whitelabel. (Adjust if product clarifies they want root logo in more places; default is parity with the mock: breadcrumb strip uses ecosystem identity.) |
| **FR-3** | **Breadcrumb** **SHALL** render as: **`Root` > `Parent1` > `Parent2` > … > `Current`**, in that order, with **all levels** from root to the active space. **SHALL** replace the first segment that today links to “My spaces” (see `Breadcrumbs` + `SpaceBreadcrumb` `rootHref` / `rootLabel`) with a segment that **starts at the root space** (link target: same pattern as `SpaceBreadcrumbItem`, i.e. agreements URL for that slug, under the active locale). |
| **FR-4** | **FR-3** **SHALL** support **unlimited** nesting depth in data (remove or raise the `maxDepth = 2` cap in `RecursiveBreadcrumbItem` unless a product cap is explicitly reintroduced). If performance is a concern, **SHALL** document batching: e.g. one server query to load the ancestor chain by walking `parent_id` with a single chain resolver (avoid N sequential round-trips in production). |
| **FR-5** | The **left panel** string that currently reads **“Hypha AI”** (and closely related `aiChat.*` strings that repeat that brand in the same panel, e.g. `openPanel`, `placeholder` where it says “Hypha AI”) **SHALL** be updated to **neutral “AI Chat”** wording in **all supported locales** (`packages/i18n/src/messages/*.json` namespace used by the panel). |
| **FR-6** | **Network** (`/[lang]/network/...`) and **My spaces** page(s) **SHALL** keep **Hypha** (or platform) branding in the app chrome **unchanged** relative to the pre-change behavior. |
| **FR-7** | **Accessibility:** breadcrumb `nav` keeps a sensible `aria-label`; logo `alt` text should describe the **ecosystem** (e.g. `"{rootSpace.title} logo"`) in the whitelabel slot, not "Hypha". |
| **FR-8** | If **root** cannot be resolved (e.g. orphan row), **SHALL** fall back to current documented behavior: use **current space** logo for FR-1 and a **single** breadcrumb item for the current space, with optional non-blocking telemetry/log. |

---

## 4) Non-functional

| ID | NFR |
|----|-----|
| **NFR-1** | **SSR:** Breadcrumb and logo resolution run on the server in the DHO layout or colocated RSC; avoid layout thrash. |
| **NFR-2** | **Caching:** If ancestor chain is added as a data loader, align with existing `findSpaceBySlug` / `findParentSpaceById` patterns; consider a small memoized `getSpaceAncestorChain({ spaceId, db })` in `@hypha-platform/core/server` for reuse and testing. |
| **NFR-3** | **E2E:** Add or update Playwright coverage for: deep hierarchy shows full trail; DHO page sticky avatar matches root; Network/My spaces still show platform logo (selectors: existing menu/header patterns). |

---

## 5) Implementation notes (for engineering)

- **Data already available:** `spaces` has `parent_id`; `findParentSpaceById` loads a row by `id` (naming: it returns the space for that `id`, not "parent only"). Today’s `RecursiveBreadcrumbItem` recurses on `parentId` but in **wrong order** and caps depth; the implementation should build **root→leaf** and map to `SpaceBreadcrumbItem` in order.
- **Component touchpoints:** `SpaceBreadcrumb` may need an API extension (e.g. `leadingItems` or multiple root segments) so the first crumb is not hard-coded to a single `rootHref` "My spaces".
- **Copy / i18n:** Grep for `Hypha AI` and `aiChat` in `packages/i18n` and the epic AI panel; ensure EN/DE/ES/FR/PT (and any other `messages` files) stay in sync.
- **Feature-flags work (separate commit in same PR or adjacent):** product flags now default **on**; Vercel `flags` / `/.well-known/vercel/flags` **removed** — E2E should rely on Hypha cookies and env only (see `packages/feature-flags/src/index.ts`).

---

## 6) Acceptance criteria (testable)

1. Given a chain **R → A → B** (R root), on **`/dho/b/...`** the **sticky** logo **matches R**’s logo URL, while the **banner/hero** still reflect **B** (per FR-2).
2. Breadcrumb text is **exactly** `R > A > B` (order), each segment linking to that space’s DHO agreements URL.
3. Grep of visible space chrome on a DHO page: no "Hypha AI" in the **left** panel after i18n update; Network and My spaces unchanged for platform logo.
4. Removing `maxDepth` does not 500 on a depth-5+ fixture space tree.

---

## 7) Traceability (open)

- If **product** requires the **root** name to be hidden when it equals the current space (root-only DHO), clarify: first segment still shows the root title or only “current” — spec default is **one segment** with root = current, same as FR-3.
