# Layout Rock-Solid Plan

> **Branch:** `feat/panel-header`  
> **Date:** 2026-03-30  
> **Goal:** Make the three-column layout (AI panel | Center | Human Chat panel) bulletproof with no overlap, no bleed, proper scrolling, and sticky headers/footers.

---

## Current Architecture Summary

```
RootLayout (apps/web/src/app/layout.tsx)
└── PanelWrapLayout (packages/epics/src/common/panel-wrap-layout.tsx)
    ├── LEFT: AiPanelProvider → SidebarProvider → Sidebar[side=left]
    │   └── AiLeftPanel: SidebarHeader | SidebarContent | SidebarFooter
    ├── CENTER: SidebarInset (nested <main>)
    │   ├── MenuTop (sticky top-0 z-20, inside SidebarInset)
    │   ├── <div class="mb-auto pb-8">
    │   │   └── {children} — routed page content
    │   └── Footer
    └── RIGHT: HumanChatPanelProvider → SidebarProvider → Sidebar[side=right]
        └── HumanRightPanel: SidebarHeader | SidebarContent | SidebarFooter
```

**Context SidePanel** (`packages/epics/src/common/side-panel.tsx`):  
Used by `@aside` routes (e.g. `select-settings-action`, proposal pages). Positioned `fixed top-9 bottom-0 right-0`.

---

## Issues Identified (with evidence)

### Issue 1: Side panels scroll with the page
**Current:** The `Sidebar` component uses `fixed inset-y-0` positioning which SHOULD make them viewport-fixed. However, the `SidebarContent` (message area) doesn't have bounded height — it uses `flex min-h-0 flex-1 overflow-auto` inside a `flex h-full flex-col` sidebar. The panels themselves are `h-svh` so they should be fixed. The real issue is that `SidebarHeader` and `SidebarFooter` aren't pinned — they're part of the flex flow inside the fixed container.

**Evidence:** Screenshot shows AI panel with header at top but AI input field extends beyond visible area when content is long.

### Issue 2: MenuTop bleeds into Human Chat panel header  
**Current:** When the AI panel opens, the `MenuTop` `sticky top-0` header spans the full width of `SidebarInset` (center column). But the Human Chat panel's `SidebarHeader` with "# Chat" title starts at `y=0` of the fixed sidebar, which visually aligns with the `MenuTop`. The "# Chat" header appears in the same row as "Network | My Spaces" nav items, looking like it's part of the menu bar rather than the panel.

**Evidence:** Screenshot `both-panels-open-issues.png` — "Chat / Members" tabs sit directly below the MenuTop border, and the "# Chat" title + close button share the same vertical space as the menu bar.

### Issue 3: Center content NOT clamped between side panels  
**Current:** The center `SidebarInset` correctly shrinks when panels open (shadcn sidebar uses gap divs that transition width). However, the space hero image and text content extends visually under the right sidebar. The `Container` component uses `max-w-container-xl` (1200px) which is wider than the available center space when both panels are open (viewport - 320px - 320px ≈ 820px on a 1440px screen).

**Evidence:** Screenshot `both-panels-open-issues.png` — hero image extends behind the right panel. Description text is cut off.

### Issue 4: Center MenuTop doesn't stay fixed on scroll  
**Current:** `MenuTop` uses `sticky top-0` which works relative to the scroll container. Since the center column (`SidebarInset`) is a `<main>` that participates in the overall document scroll (it's not `overflow-auto` itself), the sticky works. BUT the issue is that the `SidebarInset` itself has `min-h-svh` from the sidebar wrapper, and the entire page scrolls as one unit. The MenuTop needs to stay pinned at the top of the viewport within the center column, not scroll away.

**Current behavior:** `sticky top-0` on MenuTop works WHEN the scroll container is the document. This actually works. The real issue is overlap with the sidebar headers.

### Issue 5: SidePanel (`@aside` context panels) bleeds into Human Chat panel  
**Current:** `SidePanel` uses `fixed top-9 bottom-0 right-0 w-full md:w-container-sm`. The `right-0` positions it flush to the viewport edge, which overlaps with the Human Chat right sidebar (320px wide). There's even a commented-out calculation for centering it over the main content.

**Evidence:** Screenshot `settings-with-chat-panel.png` — Space Settings panel rendered BEHIND the Human Chat panel, text gets clipped.

---

## Plan

### Fix 1: Side panels — sticky header, scrollable content, sticky footer  
**Files:** `packages/ui/src/sidebar.tsx` (SidebarHeader, SidebarContent, SidebarFooter)

The Sidebar component already uses `fixed inset-y-0 h-svh` and its inner wrapper is `flex h-full w-full flex-col`. The SidebarHeader, SidebarContent, and SidebarFooter are already flex children. The issue is making sure:

- **SidebarHeader**: `flex-shrink-0` (doesn't compress) — already a flex child, just needs `shrink-0`  
- **SidebarContent**: `flex-1 min-h-0 overflow-y-auto` — already has `min-h-0 flex-1 overflow-auto` ✅  
- **SidebarFooter**: `flex-shrink-0` (doesn't compress) — needs `shrink-0`

**Action:**  
a) In `SidebarHeader`, add `shrink-0` to ensure it never collapses  
b) In `SidebarFooter`, add `shrink-0` to ensure it never collapses  
c) Verify the parent `flex h-full flex-col` on the sidebar inner div is correct  

This ensures: Header pinned top, messages scroll independently, input pinned bottom — all within the `fixed h-svh` sidebar frame.

### Fix 2: Center layout clamped between side panels — no overlap  
**Files:** `packages/ui/src/sidebar.tsx` (SidebarInset), `apps/web/src/app/layout.tsx`

The `SidebarInset` is already a `<main>` with `flex w-full flex-1`. The sidebar uses a "gap div" pattern — an invisible spacer div that transitions from `var(--sidebar-width)` to `0` when the sidebar is in offcanvas collapsed mode. This correctly pushes the center content.

**The real issue** is that the center content uses `Container` with `max-w-container-xl` (1200px) and `mx-auto`, which can exceed the available space. Plus the `SidebarInset` doesn't have `overflow-hidden` so content can visually bleed.

**Action:**  
a) Add `overflow-hidden` to `SidebarInset` so center content can never visually bleed into sidebars  
b) The `Container` max-width will naturally be constrained by `SidebarInset`'s actual width since the gap divs already work. With `overflow-hidden`, any overflow will be clipped.  
c) Ensure `SidebarInset` also has `min-w-0` to allow it to shrink below its content's intrinsic width in the flex layout  

### Fix 3: MenuTop stays fixed at top of center column, doesn't bleed  
**Files:** `packages/ui/src/organisms/menu-top.tsx`, `apps/web/src/app/layout.tsx`

**Current:** `MenuTop` uses `sticky top-0 z-20`. This works for sticky behavior within the scroll flow. But it spans the full width of `SidebarInset`, which is correct — the menu should span the center column.

**The actual visual issue:** The sidebar headers (AI panel "Hypha AI" header, Human Chat "# Chat" header) appear at the same y-position as MenuTop because both start at `top: 0` of the viewport. The sidebars are `fixed inset-y-0` so they start at `y=0`. MenuTop is `sticky top-0` inside the center column. They're at the same level, which makes them look like they're bleeding into each other.

**Action:**  
a) The sidebar panels should have a `top` offset equal to the MenuTop height so they don't overlap the menu bar. Add `top-[--menu-top-height]` to the fixed sidebar div and reduce height accordingly: `h-[calc(100svh-var(--menu-top-height))]`  
b) In `MenuTop`, measure its height and set `--menu-top-height` as a CSS variable on the document root (already has a ResizeObserver measuring `headerHeight`)  
c) **Alternatively (simpler):** Keep sidebars at `inset-y-0 h-svh` (full viewport), but make the sidebar header visually align BELOW the MenuTop by adding padding-top or by matching the MenuTop's height. The cleanest approach: sidebars start below the menu bar.

**Recommended approach:** Set sidebars to start below MenuTop:
- `MenuTop` sets `--menu-top-height` CSS variable (use the existing ResizeObserver)  
- Sidebar fixed div changes from `inset-y-0 h-svh` to `top-[var(--menu-top-height)] bottom-0 h-[calc(100svh-var(--menu-top-height))]`  
- This ensures sidebar panels sit BELOW the menu bar, not overlapping it  
- MenuTop stretches across the full viewport width (including over sidebar gap divs), creating a unified top bar  

**Wait — but MenuTop is INSIDE SidebarInset (the center column).** Currently:
```
SidebarProvider (left)
  Sidebar[left] — fixed
  SidebarInset
    SidebarProvider (right)
      SidebarInset
        MenuTop ← HERE, inside nested center
        {children}
      Sidebar[right] — fixed
```

MenuTop is constrained to the center column, NOT full viewport. If we want MenuTop to span the full viewport, it needs to be OUTSIDE the PanelWrapLayout. But that changes the architecture significantly.

**Better approach — keep current structure, make sidebars NOT overlap MenuTop:**

a) Move `MenuTop` outside `PanelWrapLayout` in `layout.tsx` so it spans full viewport width  
b) Add `pt-[var(--menu-top-height)]` to the PanelWrapLayout root or adjust sidebar `top`  
c) This way, MenuTop is ABOVE everything, and the three columns (left sidebar | center | right sidebar) all start below it  

OR (minimal change):

a) Keep MenuTop inside center column  
b) Make sidebar `fixed` divs use `top: var(--menu-top-height, 49px)` instead of `top: 0`  
c) Sidebar height becomes `calc(100svh - var(--menu-top-height, 49px))`  
d) This creates a visual gap at the top of sidebars that aligns with MenuTop  

**Chosen approach: Move MenuTop outside PanelWrapLayout** (cleaner separation of concerns):  
- MenuTop becomes a full-width fixed/sticky header above everything  
- PanelWrapLayout renders below it, sidebars start at `top: var(--menu-top-height)`  
- Center content starts naturally below MenuTop  

### Fix 4: SidePanel (context panels) right-aligned to center column, not viewport  
**Files:** `packages/epics/src/common/side-panel.tsx`

**Current:** `fixed top-9 bottom-0 right-0` — positions to viewport edge.

**Action:**  
a) Instead of `right-0`, calculate the right offset dynamically. The SidePanel needs to be right-aligned to the center column's right edge (i.e., offset by the right sidebar width when open).  
b) Use a CSS variable `--sidebar-right-width` that the `PanelWrapLayout` sets based on the right panel state:  
   - Right panel closed: `--sidebar-right-width: 0px`  
   - Right panel open: `--sidebar-right-width: 320px` (or the actual width)  
c) `SidePanel` changes to: `fixed top-[var(--menu-top-height)] bottom-0 right-[var(--sidebar-right-width,0px)]`  
d) Expose this CSS variable from `PanelWrapLayout` or from `HumanChatPanelProvider`  

**Alternative simpler approach:**  
a) Make `SidePanel` position relative to the center column instead of the viewport  
b) Change from `fixed` to `absolute` positioning inside a `relative` container  
c) But this requires the center column to be `position: relative` and the SidePanel to be a child of it  

**Chosen approach:** CSS variable on the SidePanel:  
- `PanelWrapLayout` sets `--sidebar-right-width` and `--sidebar-left-width` on its root div  
- `SidePanel` uses `right-[var(--sidebar-right-width,0px)]`  
- Also adjust `top` to account for MenuTop height  

---

## Implementation Order

### Step 1: Sidebar header/footer pinning (Fix 1)
- Add `shrink-0` to `SidebarHeader` and `SidebarFooter`
- Verify `SidebarContent` has `min-h-0 flex-1 overflow-y-auto`
- **Test:** Open both panels, send many messages — headers and input stay pinned, messages scroll

### Step 2: Move MenuTop above panels (Fix 3)
- In `layout.tsx`, move `MenuTop` OUTSIDE `PanelWrapLayout`
- `MenuTop` becomes a truly full-width sticky header at `top-0 z-30`
- `MenuTop` sets `--menu-top-height` CSS variable on `:root` via its ResizeObserver
- Update `Sidebar` fixed div to use `top-[var(--menu-top-height,49px)]` and `h-[calc(100svh-var(--menu-top-height,49px))]` instead of `inset-y-0 h-svh`
- **Problem:** `AiSidebarTrigger` and `HumanSidebarTrigger` are children of `MenuTop` but use contexts from `PanelWrapLayout`. If MenuTop moves outside PanelWrapLayout, the triggers lose their contexts.
- **Solution:** The contexts (`AiPanelProvider`, `HumanChatPanelProvider`) need to wrap BOTH the MenuTop and PanelWrapLayout. Restructure:
  ```
  AiPanelProvider
    HumanChatPanelProvider
      MenuTop (with triggers that use the contexts)
      PanelWrapLayout (reads contexts, renders sidebars)
        {children}
  ```
- This means extracting the provider logic from `PanelWrapLayout` and making PanelWrapLayout only handle the visual layout (SidebarProvider + Sidebar + SidebarInset), reading open state from the existing contexts.
- **Test:** MenuTop spans full viewport. Sidebar panels start below it. Triggers still work.

### Step 3: Center content clamped (Fix 2)
- Add `overflow-hidden` and ensure `min-w-0` on `SidebarInset`
- Center content will be naturally clamped by the flex layout — the gap divs push `SidebarInset` to shrink
- **Test:** Open both panels — hero image and text content are clipped at center column boundaries, no bleed

### Step 4: SidePanel respects sidebars (Fix 4)
- `PanelWrapLayout` sets CSS variables `--sidebar-right-width` and `--sidebar-left-width` on its root wrapper div, based on open state and `--sidebar-width`
- Update `SidePanel` from:
  ```
  fixed top-9 bottom-0 right-0
  ```
  to:
  ```
  fixed top-[var(--menu-top-height,49px)] bottom-0 right-[var(--sidebar-right-width,0px)]
  ```
- **Test:** Open Space Settings + Human Chat — settings panel right edge aligns with center column's right edge, doesn't go behind chat panel

### Step 5: Verification & regression testing
- Open/close each panel individually and both together
- Navigate to: Network page, Space page, Coherence page, Settings panel, Proposal page
- Verify at multiple viewport widths: 1280px, 1440px, 1920px
- Check mobile: sidebars should use Sheet (overlay) on mobile, no layout shift

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/ui/src/sidebar.tsx` | SidebarHeader: add `shrink-0`. SidebarFooter: add `shrink-0`. SidebarInset: add `overflow-hidden min-w-0`. Sidebar fixed div: `top-[var(--menu-top-height,49px)]` + adjusted height |
| `packages/ui/src/organisms/menu-top.tsx` | Set `--menu-top-height` CSS variable on `:root` via ResizeObserver. Ensure `z-30` or higher to sit above sidebars |
| `packages/epics/src/common/panel-wrap-layout.tsx` | Extract provider creation to separate wrapper. PanelWrapLayout reads contexts. Sets `--sidebar-right-width` / `--sidebar-left-width` CSS variables |
| `packages/epics/src/common/human-chat-panel-context.tsx` | May need to export providers separately for outer wrapping |
| `apps/web/src/app/layout.tsx` | Restructure: Providers wrap both MenuTop and PanelWrapLayout. MenuTop moves outside PanelWrapLayout |
| `packages/epics/src/common/side-panel.tsx` | Change `right-0` to `right-[var(--sidebar-right-width,0px)]`. Change `top-9` to `top-[var(--menu-top-height,49px)]` |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Moving MenuTop outside PanelWrapLayout breaks trigger context | Extract providers to wrap both — triggers use custom contexts, not `useSidebar()` |
| `overflow-hidden` on SidebarInset clips dropdowns/tooltips | Use `overflow-x-hidden` only, or ensure portaled elements (tooltips, dropdowns) render outside |
| Sidebar height calc with CSS variable fallback | Use `49px` fallback matching typical MenuTop height |
| Mobile layout regression | Sidebars use Sheet on mobile (handled by Sidebar component) — verify no change |
| SidePanel with both panels open leaves very narrow space | SidePanel already has `md:w-container-sm` (640px) — may need to cap at available center width with `max-w-[calc(100vw-var(--sidebar-left-width,0px)-var(--sidebar-right-width,0px))]` |
