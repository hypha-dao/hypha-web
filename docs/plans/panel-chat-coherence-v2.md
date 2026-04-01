# Panel / Chat / Coherence — Incremental Implementation Plan v2

> **Branch:** `feat/human-chat-panel` · **Author:** architect (senior lead fullstack Next.js engineer)  
> **Date:** 2026-03-30  
> **Scope:** All five product-owner discussion items from Task 1  

---

## Current State Verification

> Verified via headed browser (playwright-cli + Chromium) against the live dev server at `http://localhost:3000`  
> Feature flags enabled: `HYPHA_ENABLE_HUMAN_CHAT=true`, `HYPHA_ENABLE_AI_CHAT=true`  
> Screenshots saved in `screenshots/`

### What is Working ✅

| Area | Observation |
|---|---|
| AI Left Panel | Opens/closes correctly. Header fully visible: "Hypha AI" title, Sparkles icon, Reset Chat + Close Panel buttons all accessible |
| Human Chat Panel Trigger | `HumanSidebarTrigger` (MessageCircle icon) visible in MenuTop, toggles correctly |
| Human Chat Panel Open/Close | Panel slides in from the right and collapses correctly |
| Chat Tabs | Chat / Members tabs render correctly below the header |
| Chat Input | Textarea functional, auto-resize works, disabled when empty |
| Send Button | Disabled when empty, enabled when text present |
| Coherence Tab | Visible and accessible in space navigation |
| Coherence Unauthenticated State | "Please, sign in to see signals and conversations" shown correctly |
| Center Layout (right panel only) | When only right panel is open, center content properly respects panel width (~960px center on 1280px viewport) |

### What is Broken / Needs Fixing ❌

| Issue | Severity | Phase |
|---|---|---|
| **Panel header hidden behind sticky MenuTop**: `HumanChatPanelHeader` (with # icon, "Chat" title) renders at y=0 but is behind the fixed navbar. Only the close button icon is partially visible in the menu bar row. The "Chat" title and # icon are NOT visible to users. | Critical | P2 |
| **Center layout overflow with both panels open**: When both AI (left) and Human Chat (right) panels are open simultaneously, the space hero banner image extends beyond the right panel boundary. Content is not constrained to `viewport - 320px - 320px`. | High | P2 |
| **Non-functional chat bar toolbar**: Paperclip (Attach file), Image (Attach image), Bold, Emoji, @mention buttons have NO `onClick` handlers. These are mock/placeholder UI. File: `human-chat-panel-chat-bar.tsx` | High | P3 |
| **Non-functional message hover actions**: React (Smile), Reply, MoreHorizontal buttons on message bubbles have no handlers. Appear on hover. File: `human-chat-panel-message-bubble.tsx` | Medium | P3 |
| **Text-initials avatar**: Message bubbles use a `<div>` with `hsl(...)` background and text initials instead of the design system `Avatar` component. File: `human-chat-panel-message-bubble.tsx` | Medium | P3 |
| **Mock System welcome message**: A hardcoded `WELCOME_MESSAGE` with `senderName: 'System'` appears when no real messages exist. This is a placeholder that may need replacing with a proper empty state. File: `human-chat-panel-messages.tsx` | Low | P3 |
| **No `enableCoherence` flag**: Coherence features (signals, "Open conversation") are not behind a dedicated flag, can't be toggled independently of `enableHumanChat` | High | P0 |
| **Separate Matrix rooms per signal**: Current architecture creates/uses a dedicated Matrix room per Coherence signal instead of threads in the Space room | High | P4 |

### Screenshots Reference

| File | Description |
|---|---|
| `screenshots/02-space-page-with-flags.png` | Space page with both feature flags enabled, panels closed |
| `screenshots/03-human-chat-panel-open.png` | Human chat panel open (right), panels clamping correct |
| `screenshots/04-both-panels-open.png` | Both panels open — center content overflow visible |
| `screenshots/05-coherence-page.png` | Coherence page, panels closed |
| `screenshots/06-coherence-scrolled.png` | Coherence section — "Please sign in" unauthenticated state |
| `screenshots/07-coherence-chat-panel.png` | Coherence page with chat panel open — panel header hidden behind navbar |

---

## Overview

This plan delivers the following product requirements incrementally, in independently shippable phases:

1. **[Phase 0]** Feature flag for Coherence (`enableCoherence`)
2. **[Phase 1]** Reduce `ConditionalMatrixProvider` scope (provider placement)
3. **[Phase 2]** Center layout clamping + right panel positioning
4. **[Phase 3]** Chat UI polish (avatars, header styles, remove mock UI)
5. **[Phase 4]** Thread-based room architecture for Coherence signals
6. **[Phase 5]** Full E2E test suite (headed, happy-path coverage)

Each phase includes: goal, specific files, changes required, dependencies, and complexity estimate.

---

## Phase 0 — `enableCoherence` Feature Flag

**Goal:** Add a dedicated `enableCoherence` feature flag so the Coherence tab, signal cards, and thread-opening functionality can be toggled independently of `enableHumanChat`.

**Complexity:** S

### Rationale

Keeping `enableCoherence` separate from `enableHumanChat` allows:
- Deploying the space chat room without the coherence/thread layer
- Rolling back coherence features without disabling basic space chat
- Independent A/B testing and gradual rollout

### Files to Change

#### 1. `packages/cookie/src/constants.ts`
Add:
```ts
export const HYPHA_ENABLE_COHERENCE = 'HYPHA_ENABLE_COHERENCE';
```

#### 2. `packages/feature-flags/src/index.ts`
Import `HYPHA_ENABLE_COHERENCE` and add:
```ts
export const enableCoherence = flag<boolean>({
  key: 'enable-coherence',
  defaultValue: false,
  description: 'Enable Coherence signals, threads, and conversation features in space pages',
  decide({ cookies }) {
    const cookieValue = cookies.get(HYPHA_ENABLE_COHERENCE)?.value;
    if (cookieValue !== undefined) return cookieValue === 'true';
    return process.env.NEXT_PUBLIC_ENABLE_COHERENCE === 'true';
  },
});
```

#### 3. Space page server component (wherever `CoherenceBlock` is rendered)
- Resolve with `await enableCoherence()` and pass as a prop to `CoherenceBlock`
- Gate `CoherenceBlock` rendering behind `coherenceEnabled`
- Gate the "Coherence" tab/link in space navigation behind the same flag

#### 4. `packages/epics/src/coherence/components/coherence-block.tsx`
- Accept optional `coherenceEnabled: boolean` prop
- When `false`, render `null` or an appropriate empty state

#### 5. `packages/epics/src/coherence/components/signal-card.tsx`
- Gate the "Open conversation" button (thread-open action) behind a `coherenceEnabled` prop
- When `false`, hide or disable the button

### Dependencies
- None — this phase is purely additive and does not touch runtime behaviour.

### Acceptance Criteria
- `HYPHA_ENABLE_COHERENCE=true` cookie enables coherence features
- `NEXT_PUBLIC_ENABLE_COHERENCE=true` env var also enables coherence
- When disabled, the Coherence tab, signal cards, and "Open conversation" button are hidden
- `enableHumanChat` and `enableCoherence` can be toggled independently

---

## Phase 1 — `ConditionalMatrixProvider` Scope Reduction

**Goal:** Move `ConditionalMatrixProvider` (and `MatrixProvider`) down so it only wraps the `HumanRightPanel` content, rather than the entire application layout tree.

**Complexity:** S

### Rationale

Currently in `apps/web/src/app/layout.tsx`, `ConditionalMatrixProvider` wraps `PanelWrapLayout` and therefore the **entire application subtree**. This means Matrix SDK initialises (auth token fetch, client start, presence set) even for pages and components that never use the chat panel. Moving it down to only wrap `HumanRightPanel`:
- Removes Matrix initialization cost from non-chat routes
- Makes the dependency graph explicit: only `HumanRightPanel` needs Matrix
- Reduces provider nesting depth in the global tree

### Files to Change

#### 1. `apps/web/src/app/layout.tsx`
**Remove** the `<ConditionalMatrixProvider>` wrapper around `<PanelWrapLayout>`.

**Change** the `right` slot to inline the Matrix provider:
```tsx
// Before:
<ConditionalMatrixProvider enabled={humanChatEnabled}>
  <PanelWrapLayout
    right={humanChatEnabled ? { content: <HumanRightPanel /> } : undefined}
    ...
  >
    ...
  </PanelWrapLayout>
</ConditionalMatrixProvider>

// After:
<PanelWrapLayout
  right={
    humanChatEnabled
      ? {
          content: (
            <MatrixProvider>
              <HumanRightPanel />
            </MatrixProvider>
          ),
        }
      : undefined
  }
  ...
>
  ...
</PanelWrapLayout>
```

Note: Since `humanChatEnabled` is already checked before passing to `right`, we no longer need the conditional wrapper — we know Matrix should be active. Import `MatrixProvider` directly from `@hypha-platform/core/client`.

#### 2. `apps/web/src/components/conditional-matrix-provider.tsx`
- Mark as deprecated or delete if no other consumer exists.
- Verify with `grep -r "ConditionalMatrixProvider"` before deleting.

### Dependencies
- None — this phase is a pure refactor with no behaviour change.

### Acceptance Criteria
- `MatrixProvider` is no longer in the provider tree on pages where `HumanRightPanel` is not rendered
- Human chat panel still works identically after the move
- No regressions in existing E2E tests

---

## Phase 2 — Center Layout Clamping, Panel Positioning & Header Visibility

**Goal:** Fix three layout issues: (a) center content area must be properly clamped between the two open sidebars, (b) aside-route panels inside center content must be positioned relative to the center layout, and (c) the Human Chat Panel header is hidden behind the sticky MenuTop navbar.

**Complexity:** M

### Issue A: Center Content Clamping

In `apps/web/src/app/layout.tsx`, the center content is:
```tsx
<div className="mb-auto pb-8">
  <div className="pt-9 h-full flex justify-normal">
    <div className="w-full h-full">{children}</div>
  </div>
</div>
```

`PanelWrapLayout` uses `SidebarInset` from shadcn/ui which transitions `margin-left`/`margin-right` when sidebars open. However, the inner `<div className="w-full h-full">` may not respect the computed inset, causing overflow.

**Fix:**

#### `apps/web/src/app/layout.tsx`
- Ensure the center content wrapper uses `min-w-0` to prevent flex overflow:
  ```tsx
  <div className="mb-auto pb-8 min-w-0 flex-1">
    <div className="pt-9 h-full flex flex-col">
      <div className="min-w-0 w-full h-full">{children}</div>
    </div>
  </div>
  ```
- Verify `SidebarInset` applies CSS variable `--sidebar-width` transitions correctly for both left and right sidebars simultaneously.

#### `packages/epics/src/common/panel-wrap-layout.tsx`
- The outer `SidebarInset` (center area) must account for both sidebar widths. If shadcn only applies one `margin` offset (for the left sidebar), add explicit `style` to combine both:
  ```tsx
  // Inside PanelWrapLayout, on the innermost SidebarInset wrapping children:
  // Ensure margin-inline-start accounts for left sidebar and margin-inline-end
  // accounts for right sidebar using CSS custom properties.
  ```
- Alternatively: wrap `children` in a `flex-1 min-w-0 overflow-hidden` container to prevent content from bleeding under open sidebars.

### Issue C: Panel Header Hidden Behind Sticky Navbar

**Verified in browser**: `HumanChatPanelHeader` (# icon, "Chat" title, Close button) renders at `y=0` but is covered by the sticky `MenuTop` navigation bar. Users see tabs as the first visible element of the panel; the header with the title and close button is NOT visible.

The root cause: shadcn's `Sidebar` with `side="right"` uses `position: fixed; top: 0`, so its `SidebarHeader` starts at the very top of the viewport. The `MenuTop` is also at `top: 0` with a higher `z-index`, covering the panel header.

**Fix:**

**Option A (preferred): Add top offset to sidebar content**

In `packages/epics/src/common/panel-wrap-layout.tsx`, add a `data-` attribute or CSS class to the right sidebar so it accounts for the navbar height:

```tsx
<Sidebar side="right" variant="sidebar" collapsible="offcanvas"
  className="top-[var(--navbar-height,56px)]"  // account for sticky navbar
>
```

Define `--navbar-height` as a CSS variable set on the `<html>` element or body (e.g., `56px` for the current MenuTop height), or use a hardcoded value measured from the actual MenuTop component.

**Option B: Pad the SidebarHeader from inside**

In `apps/web/src/app/layout.tsx`, wrap the right panel content to add a top spacer:

```tsx
right={{
  content: (
    <MatrixProvider>
      <div className="h-14" aria-hidden />  {/* navbar-height spacer */}
      <HumanRightPanel />
    </MatrixProvider>
  )
}}
```

This pushes the `SidebarHeader` (inside `HumanRightPanel`) below the navbar area without touching the sidebar component itself.

**Option C: Use `data-sidebar` CSS variable approach**

In the shadcn sidebar CSS, adjust `--sidebar-height` to start below the navbar by setting `top: var(--navbar-height)` in the sidebar's fixed positioning.

**Recommended approach: Option B** (minimal footprint, no shadcn internals changes), pending measurement of actual navbar height.

### Issue B: Aside Route Panel Positioning

Space pages use parallel/aside routes (e.g., `@aside` slot) that render a detail panel. Currently these panels may be `position: fixed` with `right: 0` anchored to the viewport, causing them to overlap the open human chat sidebar.

**Fix:**

#### Space layout or aside slot layout (e.g., `apps/web/src/app/[lang]/dho/[id]/layout.tsx` or `@aside/layout.tsx`)
- Change the aside panel container from `position: fixed; right: 0` to `position: sticky` or CSS `position: absolute` relative to `SidebarInset`.
- If the aside panel uses a fixed overlay, constrain its `right` offset to `var(--sidebar-width)` when the human chat sidebar is open:
  ```tsx
  // Pass `humanChatPanelOpen` state from context and apply:
  style={{ right: humanChatPanelOpen ? 'var(--sidebar-width, 0px)' : '0' }}
  ```
- The preferred approach is to make the aside panel a **flex sibling** inside `SidebarInset` rather than a fixed overlay, so it respects the inset boundaries naturally.

### Dependencies
- Phase 1 should complete first (provider refactor) so layout is clean before CSS changes.
- Aside route file paths need confirmation via `find apps/web/src/app -name "layout.tsx" -path "*aside*"`.

### Acceptance Criteria
- When both sidebars are open, center content stays between the two panels and does not overflow
- Aside route detail panels align to the right edge of `SidebarInset` (not the viewport)
- No horizontal scroll on the center content area

---

## Phase 3 — Chat UI Polish

**Goal:** Three targeted UI improvements to the `HumanRightPanel` and `human-chat-panel` components: (a) replace text-initials avatar with design-system avatars, (b) remove non-functional hover action buttons, (c) align chat header styling with `AiPanelHeader` and `MenuTop`.

**Complexity:** S

### 3a — Design System Avatars

**File:** `packages/epics/src/common/human-chat-panel/human-chat-panel-message-bubble.tsx`

Currently renders a `<div>` with `hsl(...)` background and text initials. Replace with the `Avatar` / `AvatarImage` / `AvatarFallback` components from `@hypha-platform/ui`:

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@hypha-platform/ui';

// Replace the <div className="mt-0.5 flex h-9 w-9 ..."> avatar block with:
<Avatar className="mt-0.5 h-9 w-9 shrink-0">
  {avatarUrl && <AvatarImage src={avatarUrl} alt={senderName} />}
  <AvatarFallback className="text-xs font-semibold">
    {initials}
  </AvatarFallback>
</Avatar>
```

The `UIMessage` type will need an optional `avatarUrl?: string` field. `HumanRightPanel` populates it from `client.getUser(msg.sender)?.avatarUrl` (Matrix SDK user avatar).

**Files affected:**
- `packages/epics/src/common/human-chat-panel/human-chat-panel-message-bubble.tsx` — replace avatar impl
- `packages/epics/src/common/human-right-panel.tsx` — add `avatarUrl` to `toUIMessage()`

### 3b — Remove Non-Functional UI Elements

**Verified in browser**: Two sets of placeholder UI are confirmed non-functional:

#### 3b-i: Message Bubble Hover Actions
**File:** `packages/epics/src/common/human-chat-panel/human-chat-panel-message-bubble.tsx`

Remove the entire "Hover action bar" block (the `group-hover:opacity-100` div containing Smile, Reply, and MoreHorizontal icon buttons). These are placeholder UI elements that currently have no `onClick` handlers. They will be re-introduced in a future phase when reactions and threading are implemented.

```tsx
// DELETE this block entirely:
<div className="absolute right-2 top-0 -translate-y-1/2 flex items-center gap-0.5 rounded-md border ...">
  <button ...><Smile /></button>
  <button ...><Reply /></button>
  <button ...><MoreHorizontal /></button>
</div>
```

Remove unused imports: `Smile`, `Reply`, `MoreHorizontal` from `lucide-react`, and the translation keys `reactButton`, `replyButton`, `moreButton` from `HumanChatPanel` i18n namespace.

#### 3b-ii: Chat Bar Non-Functional Toolbar Buttons
**File:** `packages/epics/src/common/human-chat-panel/human-chat-panel-chat-bar.tsx`

**Verified in browser**: Paperclip (Attach file), Image (Attach image), Bold, Emoji (Smile), and AtSign (@mention) buttons have NO `onClick` handlers. They are purely decorative.

Remove these non-functional buttons from the toolbar. Keep only the **Send** button, which is functional:

```tsx
// DELETE the left icon group (Paperclip + Image) entirely:
<div className="flex items-center gap-0.5">
  <button ...><Paperclip /></button>
  <button ...><Image /></button>
</div>

// In the right icon group, DELETE Bold, Smile, AtSign buttons. Keep only Send:
<div className="flex items-center gap-0.5">
  <button ... onClick={onSend} disabled={!canSend}>
    <Send />
  </button>
</div>
```

Remove unused imports: `Paperclip`, `Image`, `Bold`, `Smile`, `AtSign` from `lucide-react` and corresponding i18n translation keys (`attachFile`, `attachImage`, `bold`, `emoji`, `mention`).

#### 3b-iii: Mock System Welcome Message
**File:** `packages/epics/src/common/human-chat-panel/human-chat-panel-messages.tsx`

The hardcoded `WELCOME_MESSAGE` constant with `senderName: 'System'` appears when there are no real messages. This is a placeholder. Replace with a proper empty state component:

```tsx
// Instead of WELCOME_MESSAGE, render an empty state:
const displayMessages = messages.length > 0 ? messages : null;

return (
  <div ...>
    {displayMessages ? (
      <div className="flex flex-col gap-4">
        {displayMessages.map(...)}
      </div>
    ) : (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
      </div>
    )}
  </div>
);
```

Also delete `packages/epics/src/common/human-chat-panel/mock-data.ts` — the `createMockWelcomeMessage` export is not used anywhere in the codebase.

### 3c — Chat Header Style Alignment

**File:** `packages/epics/src/common/human-chat-panel/human-chat-panel-header.tsx`

Compare current header styles with `AiPanelHeader` (`packages/epics/src/common/ai-panel/ai-panel-header.tsx`):

| Property | AiPanelHeader | HumanChatPanelHeader | Target |
|---|---|---|---|
| Container padding | `px-4 py-3` | `px-4 py-3` | ✅ Match |
| Icon button size | `h-7 w-7` | `h-7 w-7` | ✅ Match |
| Icon button hover | `hover:bg-muted` | `hover:bg-muted` | ✅ Match |
| Title font | `font-semibold text-sm` | `font-semibold text-sm` | ✅ Match |
| Border | `border-b border-border` | `border-b border-border` | ✅ Match |
| Background | `bg-background-2` | `bg-background-2` | ✅ Match |

The header styles are already largely aligned. The remaining delta is:
- `AiPanelHeader` uses `flex-wrap` and `gap-x-2 gap-y-2` for multi-action headers
- `HumanChatPanelHeader` uses `gap-2` without wrap

**Changes:**
- Add `flex-wrap` to `HumanChatPanelHeader` container for consistency
- Verify padding matches `MenuTop` header (check `packages/ui/src/components/menu-top/`)
- Ensure `SidebarHeader` `p-0` override in `HumanRightPanel` (`<SidebarHeader className="bg-background-2 p-0">`) removes all default padding so the header component controls its own spacing — this is already correct

### Dependencies
- No phase dependencies. This phase is safe to ship any time.

### Acceptance Criteria
- Message bubbles render design-system Avatars with image fallback to initials
- No Smile/Reply/More hover buttons appear on hover
- Human chat header visually matches AI chat header (padding, icons, typography)

---

## Phase 4 — Thread-Based Room Architecture

**Goal:** Replace the current "separate Matrix room per signal" model with "threads inside the Space's single chat room." Each Space has ONE Matrix room; Coherence signals create Matrix threads within it.

**Complexity:** L

### Architecture Decision

**Before (current):**
- Each Coherence signal stores a `roomId` pointing to a dedicated Matrix room
- Opening a signal's chat means joining and displaying a separate room
- Space chat uses a separate room identified by `spaceSlug`

**After (target):**
- Each Space has ONE canonical Matrix room (stored/discovered by `spaceSlug`, same as today's "space room" logic in `HumanRightPanel`)
- A Coherence signal's conversation is a **Matrix thread** (m.thread relation) inside the Space room
- The signal stores `threadRootEventId` — the event ID of the thread's root message
- Opening a signal's chat opens the Space room filtered to that thread

**Why this is correct:**
- Matches the product vision: "each Space has ONE room, signals create threads within it"
- Reduces Matrix room proliferation
- Threads are natively supported by Matrix SDK (`m.thread` relation type)
- Existing space room join logic is preserved

### Sub-Step 4.0 — Data Model Update

**File:** `packages/core/src/coherence/types.ts`

```ts
export interface CreateCoherenceInput {
  // ... existing fields ...
  roomId?: string;           // DEPRECATED — kept for migration compatibility
  threadRootEventId?: string; // NEW — Matrix thread root event ID
}

export interface UpdateCoherenceInput {
  // ... existing fields ...
  roomId?: string;           // DEPRECATED
  threadRootEventId?: string; // NEW
}

export type Coherence = {
  // ... existing fields ...
  roomId?: string;           // DEPRECATED — still read for migration
  threadRootEventId?: string; // NEW
};
```

**Database migration:** Add `thread_root_event_id` column to the coherence table (nullable, no default). Existing rows keep `roomId` for backward compatibility.

**Files:**
- `packages/core/src/coherence/types.ts` — add `threadRootEventId` fields
- `packages/core/src/coherence/server/` — update server actions / db queries to read/write `threadRootEventId`
- `packages/core/src/coherence/client/` — update client hooks if they map db fields

### Sub-Step 4.1 — Matrix SDK Thread Support

**File:** `packages/core/src/matrix/client/providers/matrix-provider.tsx`

Add thread operations to `MatrixContextType` and `MatrixProvider`:

```ts
interface MatrixContextType {
  // ... existing methods ...
  
  /**
   * Create a new thread in a room. Sends an initial message as the thread root.
   * Returns the event ID of the root message (to store as threadRootEventId).
   */
  createThread: (roomId: string, initialMessage: string) => Promise<{ threadRootEventId: string }>;
  
  /**
   * Send a message inside an existing thread.
   */
  sendThreadMessage: (params: { roomId: string; threadRootEventId: string; message: string }) => Promise<void>;
  
  /**
   * Get all messages in a thread (from local timeline, filtered by threadRootEventId).
   */
  getThreadMessages: (roomId: string, threadRootEventId: string) => Message[] | null;
  
  /**
   * Register a real-time listener for new messages in a thread.
   */
  registerThreadListener: (
    roomId: string,
    threadRootEventId: string,
    messageListener: RoomMessageListener,
  ) => void;
  
  /**
   * Unregister a thread listener.
   */
  unregisterThreadListener: (roomId: string, threadRootEventId: string) => void;
}
```

**Implementation notes for Matrix SDK (matrix-js-sdk):**

- **Creating a thread:** Send the root message as a normal `m.room.message`, then subsequent thread messages use `m.relates_to` with `rel_type: "m.thread"` pointing to the root event ID.
  ```ts
  // Send root message:
  const { event_id } = await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: MsgType.Text,
    body: initialMessage,
  });
  return { threadRootEventId: event_id };
  ```
  
- **Sending in thread:**
  ```ts
  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: MsgType.Text,
    body: message,
    'm.relates_to': {
      rel_type: 'm.thread',
      event_id: threadRootEventId,
    },
  });
  ```

- **Getting thread messages:** Filter room timeline events where `event.getRelation()?.rel_type === 'm.thread'` and `event.getRelation()?.event_id === threadRootEventId`. Also include the root event itself.

- **Thread listener:** In `registerRoomListener`'s event handler, filter for thread events. Create a dedicated listener variant that only fires for the given `threadRootEventId`.

### Sub-Step 4.2 — Context & Panel Updates

**File:** `packages/epics/src/common/human-chat-panel-context.tsx`

Update context to use `threadRootEventId` instead of `coherenceRoomId`:

```ts
export type HumanChatPanelContextValue = {
  open: boolean;
  toggle: () => void;
  mode: 'space' | 'thread';              // renamed: coherence → thread
  threadRootEventId: string | null;       // replaces coherenceRoomId
  threadTitle: string | null;             // replaces coherenceTitle
  coherenceSlug: string | null;
  openThreadChat: (threadRootEventId: string | null, title: string, slug: string) => void;
  closeThreadChat: () => void;            // replaces closeCoherenceChat
};
```

The `openThreadChat` accepts `threadRootEventId: string | null` — `null` means the thread hasn't been created yet (first-time open creates it on first send).

**File:** `packages/epics/src/common/human-right-panel.tsx`

Update `HumanRightPanel` dual-mode logic:

- **Space mode** (`mode === 'space'`): Existing logic unchanged — join/create the space room, display non-threaded messages (filter out `m.thread` relation events), send normal messages.
- **Thread mode** (`mode === 'thread'`): 
  - The Space room must already be joined (from `mode === 'space'` baseline, or join it fresh)
  - If `threadRootEventId` is non-null, call `getThreadMessages(spaceRoomId, threadRootEventId)` and display those
  - If `threadRootEventId` is null (new thread), on first send: call `createThread(spaceRoomId, message)`, get back `threadRootEventId`, persist via `updateCoherenceBySlug({ slug, threadRootEventId })`, then update context
  - Register `registerThreadListener(spaceRoomId, threadRootEventId, callback)` instead of room listener

Key implementation detail: in thread mode, the panel joins the **space room** (not a signal-specific room). The `spaceSlug` is always available from URL params. Thread mode simply changes the message filter applied on top of the room.

### Sub-Step 4.3 — SignalCard & CoherenceBlock Updates

**File:** `packages/epics/src/coherence/components/signal-card.tsx`

- Change "Open conversation" button: call `onOpenConversation()` with `threadRootEventId` instead of `roomId`
- Disable button when `isLoading` (unchanged behaviour)
- The "disabled when no room" logic changes: button is enabled even when `threadRootEventId` is null (first click creates the thread on send)
- Pass `threadRootEventId` prop instead of `roomId` prop

**File:** `packages/epics/src/coherence/components/coherence-block.tsx`

Update `handleSignalClick`:
```ts
const handleSignalClick = useCallback(
  (signal: Coherence) => {
    openThreadChat(
      signal.threadRootEventId ?? null,
      signal.title,
      signal.slug!,
    );
  },
  [openThreadChat],
);
```

### Sub-Step 4.4 — Migration Strategy

Signals with existing `roomId` values:
- On `HumanRightPanel` mount in thread mode: if `threadRootEventId` is null but `roomId` is present, fall back to the legacy room-based approach (join `roomId`, display messages from that room as if it were a thread)
- Mark legacy signals visually (optional: show "Legacy conversation" label)
- Provide a one-time migration script (server-side) to create a thread in the space room seeded with messages from the legacy room, then update `threadRootEventId` and clear `roomId`

### Dependencies
- Phase 0 (feature flag) should be complete — coherence features are gated
- Phase 1 (provider scope) should be complete — MatrixProvider must be available in the right panel tree
- Sub-steps within Phase 4 must be done in order: 4.0 → 4.1 → 4.2 → 4.3

### Acceptance Criteria
- Signal card click opens the right panel in "thread view" within the space room
- Thread messages are isolated — space chat and thread chat don't mix
- First click on a signal with no `threadRootEventId` creates a thread on the first message send
- `threadRootEventId` is persisted to the Coherence record after thread creation
- Existing signals with `roomId` continue to work (legacy fallback)
- `enableCoherence` flag gates all thread-opening functionality

---

## Phase 5 — E2E Test Suite (Headed, Full Happy Path)

**Goal:** Update E2E configuration to run headed, create an auth fixture, and implement full happy-path coverage for all five product areas.

**Complexity:** M

### 5a — Playwright Headed Configuration

**File:** `apps/web-e2e/playwright-local.config.ts`

```ts
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    headless: false,   // ADD: run headed on dev machines
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

Note: `playwright.config.ts` (CI config) remains unchanged — CI runs headless.

### 5b — Auth Fixture

**New file:** `apps/web-e2e/src/fixtures/auth.fixture.ts`

Create a Playwright fixture that:
1. Sets the Privy/JWT authentication cookie so the app considers the user authenticated
2. Sets `HYPHA_ENABLE_HUMAN_CHAT=true`, `HYPHA_ENABLE_COHERENCE=true` cookies for feature flags
3. (If Matrix requires separate auth): sets the Matrix access token in local storage or cookie

```ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Set feature flag cookies
    await page.context().addCookies([
      { name: 'HYPHA_ENABLE_HUMAN_CHAT', value: 'true', domain: '127.0.0.1', path: '/' },
      { name: 'HYPHA_ENABLE_COHERENCE', value: 'true', domain: '127.0.0.1', path: '/' },
      // Add JWT/auth cookie if available from env var:
      ...(process.env.E2E_AUTH_COOKIE
        ? [{ name: 'privy-token', value: process.env.E2E_AUTH_COOKIE, domain: '127.0.0.1', path: '/' }]
        : []),
    ]);
    await use(page);
  },
});
```

### 5c — Happy Path E2E Specs

#### Spec 1: Space Chat Full Flow
**New file:** `apps/web-e2e/src/space-chat-happy-path.spec.ts`

Using `playwright-local.config.ts` (headed):
```
✅ Open space page
✅ Click HumanSidebarTrigger — panel opens
✅ Panel shows "Chat" header with # icon
✅ Type a message in the chat input
✅ Send button becomes enabled
✅ Click Send (or press Enter)
✅ Message appears in the messages list (mocked Matrix or real auth)
✅ Close panel — panel hides
```

#### Spec 2: Coherence Thread Full Flow
**New file:** `apps/web-e2e/src/coherence-thread-happy-path.spec.ts`

```
✅ Navigate to /[lang]/dho/[spaceSlug]/coherence
✅ Signal cards are visible (coherenceEnabled + authenticated)
✅ Click "Open conversation" on a signal card
✅ Panel opens in thread mode — title shows signal title
✅ Back button (ArrowLeft) is visible
✅ Type a message — send button enabled
✅ Send message — message appears in thread
✅ Click back — panel returns to space chat mode
✅ # icon visible, title is "Chat"
```

#### Spec 3: Panel Layout — Clamping & Overlap
**New file:** `apps/web-e2e/src/panel-layout.spec.ts`

```
✅ Open AI panel (left) and Human chat panel (right) simultaneously
✅ Center content bounding box does not overlap either sidebar
✅ No horizontal scrollbar visible
✅ Open/close panels — center content transitions smoothly
✅ Aside route panel (if open) right edge does not exceed SidebarInset right boundary
```

#### Spec 4: Feature Flag Gating
**New file:** `apps/web-e2e/src/feature-flags.spec.ts`

```
✅ With HYPHA_ENABLE_HUMAN_CHAT=false: HumanSidebarTrigger not visible
✅ With HYPHA_ENABLE_COHERENCE=false: "Open conversation" button not visible on signal cards
✅ With HYPHA_ENABLE_COHERENCE=false and HYPHA_ENABLE_HUMAN_CHAT=true: panel opens in space chat only, no thread mode
✅ With HYPHA_ENABLE_COHERENCE=true: all coherence UI visible
```

#### Existing Specs — Remove `test.fixme`
Update `apps/web-e2e/src/coherence-chat-panel.spec.ts`:
- Remove `test.fixme` from all tests that require authentication
- Use `authenticatedPage` fixture from `auth.fixture.ts`
- Remove TODO comments once auth fixture is in place

### Dependencies
- Phase 4 must be complete (thread architecture) before coherence happy-path specs can pass
- Auth fixture requires E2E credentials available via environment variable
- Phase 0 (feature flags) must be complete for feature-flag gating specs

### Acceptance Criteria
- `npx playwright test --config playwright-local.config.ts` runs headed in Chromium
- All happy-path specs pass on a dev machine with Matrix credentials configured
- No `test.fixme` remain in specs that have working implementations
- CI config (`playwright.config.ts`) continues to run headless (no change)

---

## Phase Dependency Map

```
Phase 0 (Feature Flag)
  └─► Phase 4 (Thread Architecture) ─── depends on Phase 0
  └─► Phase 5 (E2E flags spec)     ─── depends on Phase 0

Phase 1 (Provider Scope)
  └─► Phase 4 (Thread Architecture) ─── depends on Phase 1

Phase 2 (Layout Clamping)           ─── independent (safe after Phase 1)
Phase 3 (UI Polish)                 ─── fully independent

Phase 4 (Thread Architecture)
  └─► Phase 5 (E2E coherence spec)  ─── depends on Phase 4

Phase 5 (E2E Suite)                 ─── depends on Phases 0, 4
```

**Recommended delivery order:**
```
Phase 0 → Phase 1 → Phase 3 → Phase 2 → Phase 4 → Phase 5
```
(Phase 3 can be done in parallel with Phase 2; both are independent of Phase 4)

---

## Complexity & Effort Summary

| Phase | Description | Complexity | Est. Effort |
|---|---|---|---|
| Phase 0 | `enableCoherence` feature flag | S | 0.5 days |
| Phase 1 | Provider scope reduction | S | 0.5 days |
| Phase 2 | Center layout clamping + panel header visibility + aside positioning | M | 1.5–2.5 days |
| Phase 3 | Chat UI polish (avatars, remove mock toolbar/hover/welcome) | S | 1–1.5 days |
| Phase 4 | Thread-based room architecture | L | 3–5 days |
| Phase 5 | E2E test suite (headed, full happy path) | M | 1–2 days |
| **Total** | | | **7.5–12.5 days** |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Matrix SDK thread support (m.thread) behaves differently across server versions | Medium | High | Test against target homeserver version; add version check in provider init |
| Legacy `roomId` signals cannot be automatically migrated | Low | Medium | Keep legacy fallback indefinitely; migration is opt-in |
| Center layout clamping requires shadcn `SidebarInset` internal class overrides | Medium | Medium | Use CSS variables (`--sidebar-width`) rather than overriding internal classes |
| E2E auth fixture requires real Matrix credentials in CI | High | Medium | Gate Matrix-specific tests with `test.skip` in CI; only run on dev machines via local config |
| Thread message filtering misses events loaded before listener registered | Medium | Medium | Load thread messages from timeline on mount; listener handles only new real-time events |

---

## Open Questions

1. **Database migration for `threadRootEventId`**: Is there a migration tool/pattern already in use (e.g., Drizzle migrations, Prisma)? The plan assumes additive column addition.
2. **Space room per-user vs. shared**: Is the space room public (shared by all members) or private? Current code uses `RoomPreset.PublicChat` — confirm this is intentional.
3. **Thread UI in panel**: Should thread mode show only thread messages, or show the thread in-context (with the root message + replies visually grouped)? This affects `HumanChatPanelMessages` rendering complexity.
4. **Aside route panel files**: Need to confirm exact file paths for the aside/detail panels that have the positioning issue (Phase 2b).

---

*This plan is a living document. Reviewers should annotate sections with questions, risks, or product alignment concerns before implementation begins.*
