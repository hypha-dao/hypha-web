---
title: "Coherence Chat → Human Right Panel — Implementation Plan"
date: 2026-03-29
status: draft
tags: [coherence, human-right-panel, matrix, implementation, plan]
parent: docs/index.md
---

# Coherence Chat → Human Right Panel — Implementation Plan

> Incremental steps to integrate coherence signal chats into the Human Right Panel sidebar.  
> See [coherence-chat-panel-research.md](./coherence-chat-panel-research.md) for architecture decisions.

---

## Guiding Principles

- **Additive changes only** — space chat mode is preserved exactly as-is.
- **Each step = one conventional commit** that leaves the app in a buildable, working state.
- **Context-first** — extend the context before wiring consumers, so each step is independently testable.
- **No new routes** — this integration removes the need for `@aside/coherence/chat/[slug]` navigation.

---

## Dependency Graph

```text
Step 1: Extend HumanChatPanelContext (mode + coherence state)
   ↓
Step 2: Update HumanRightPanel (dual-mode room logic)
   ↓
Step 3: Update HumanChatPanelHeader (back button)
   ↓
Step 4: Update SignalCard (onOpenConversation prop)
   ↓
Step 5: Update SignalGrid + SignalSection (onSignalClick threading)
   ↓
Step 6: Update CoherenceBlock (wire openCoherenceChat + sidebar)
```

---

## Steps

### Step 1 — Extend `HumanChatPanelContext`

**Commit:** `feat(epics/human-chat): extend panel context with coherence mode`

**File:** `packages/epics/src/common/human-chat-panel-context.tsx`

**Changes:**

1. Keep `PanelContextValue` (used by `AiPanelContext`) unchanged.
2. Add new `HumanChatPanelContextValue` type:

```ts
export type HumanChatPanelContextValue = {
  open: boolean;
  toggle: () => void;
  // Coherence mode
  mode: 'space' | 'coherence';
  coherenceRoomId: string | null;
  coherenceTitle: string | null;
  coherenceSlug: string | null;
  openCoherenceChat: (roomId: string, title: string, slug: string) => void;
  closeCoherenceChat: () => void;
};
```

1. Update `HumanChatPanelContext` default value and type to `HumanChatPanelContextValue`.
2. Update `HumanChatPanelProvider` to accept and provide the full shape — the provider will now need to hold state internally (use `useState` inside a wrapper component) rather than a raw `Context.Provider`:

```tsx
// New: stateful provider wrapper
export function HumanChatPanelProvider({
  children,
  open,
  toggle,
}: {
  children: React.ReactNode;
  open: boolean;
  toggle: () => void;
}) {
  const [mode, setMode] = useState<'space' | 'coherence'>('space');
  const [coherenceRoomId, setCoherenceRoomId] = useState<string | null>(null);
  const [coherenceTitle, setCoherenceTitle] = useState<string | null>(null);
  const [coherenceSlug, setCoherenceSlug] = useState<string | null>(null);

  const openCoherenceChat = useCallback(
    (roomId: string, title: string, slug: string) => {
      setCoherenceRoomId(roomId);
      setCoherenceTitle(title);
      setCoherenceSlug(slug);
      setMode('coherence');
    },
    [],
  );

  const closeCoherenceChat = useCallback(() => {
    setMode('space');
    setCoherenceRoomId(null);
    setCoherenceTitle(null);
    setCoherenceSlug(null);
  }, []);

  return (
    <HumanChatPanelContext.Provider
      value={{ open, toggle, mode, coherenceRoomId, coherenceTitle, coherenceSlug, openCoherenceChat, closeCoherenceChat }}
    >
      {children}
    </HumanChatPanelContext.Provider>
  );
}
```

1. Update `useHumanChatPanel()` return type to `HumanChatPanelContextValue`.

**Verify:** `pnpm nx run epics:build` passes. Existing consumers of `useHumanChatPanel()` only use `{ open, toggle }` — no breaking change to call sites.

**Check callers:** `HumanSidebarTrigger` and layout wiring in `apps/web` use `open` + `toggle` only — no changes needed.

---

### Step 2 — Update `HumanRightPanel` for Dual-Mode Room Logic

**Commit:** `feat(epics/human-chat): support coherence room mode in HumanRightPanel`

**File:** `packages/epics/src/common/human-right-panel.tsx`

**Changes:**

1. Import `useHumanChatPanel` from context.
2. Read `mode`, `coherenceRoomId`, `coherenceTitle`, `closeCoherenceChat` from context.
3. Add a second `useEffect` that handles coherence room joining:

```ts
// When mode switches to 'coherence' and coherenceRoomId is set
useEffect(() => {
  if (mode !== 'coherence' || !coherenceRoomId || !isMatrixAvailable || !isMatrixAuthenticated) return;
  // Unregister any existing space room listener
  if (roomId && roomId !== coherenceRoomId) {
    matrixRef.current.unregisterRoomListener(roomId);
  }
  // Join coherence room
  let cancelled = false;
  const init = async () => {
    try {
      await matrixRef.current.joinRoom(coherenceRoomId);
      if (cancelled) return;
      setRoomId(coherenceRoomId);
      const existing = matrixRef.current.getRoomMessages(coherenceRoomId);
      if (existing) setMessages(existing.map(m => toUIMessage(m, currentUserIdRef.current)));
    } catch (err) {
      if (!cancelled) setError('Failed to join conversation room');
    }
  };
  init();
  return () => { cancelled = true; };
}, [mode, coherenceRoomId, isMatrixAvailable, isMatrixAuthenticated]);
```

1. Reset mode when sidebar closes — listen to `useSidebar().open`:

```ts
const { open: sidebarOpen } = useSidebar();
const prevSidebarOpenRef = useRef(sidebarOpen);
useEffect(() => {
  if (prevSidebarOpenRef.current && !sidebarOpen && mode === 'coherence') {
    closeCoherenceChat();
  }
  prevSidebarOpenRef.current = sidebarOpen;
}, [sidebarOpen, mode, closeCoherenceChat]);
```

1. Pass `title` and `onBack` to `HumanChatPanelHeader`:

```tsx
<HumanChatPanelHeader
  title={mode === 'coherence' ? coherenceTitle ?? undefined : undefined}
  onBack={mode === 'coherence' ? closeCoherenceChat : undefined}
/>
```

**Verify:** Space chat mode is unaffected. Switching mode to `'coherence'` (manually in devtools) joins the coherence room.

---

### Step 3 — Update `HumanChatPanelHeader` with Back Button

**Commit:** `feat(epics/human-chat): add back button to panel header for coherence mode`

**File:** `packages/epics/src/common/human-chat-panel/human-chat-panel-header.tsx`

**Changes:**

1. Add `onBack?: () => void` prop to `HumanChatPanelHeaderProps`.
2. When `onBack` is provided:
   - Replace `Hash` icon with `ArrowLeft` (lucide-react).
   - The icon becomes a clickable button that calls `onBack()`.
3. Keep the close (`PanelRightClose`) button as-is.

```tsx
type HumanChatPanelHeaderProps = {
  title?: string;
  description?: string;
  onBack?: () => void;
};

// In render:
<div className="flex items-center gap-1.5">
  {onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      aria-label={t('backToSpaceChat')}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  ) : (
    <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
  )}
  <span className="font-semibold text-sm text-foreground truncate">
    {displayTitle}
  </span>
</div>
```

1. Add `backToSpaceChat` key to `HumanChatPanel` i18n namespace (en.json + other locales).

**Verify:** Header shows back arrow when `onBack` is set. Hash icon shows otherwise. Back button returns panel to space chat.

---

### Step 4 — Update `SignalCard` with `onOpenConversation` Prop

**Commit:** `feat(epics/coherence): wire open-conversation callback in SignalCard`

**File:** `packages/epics/src/coherence/components/signal-card.tsx`

**Changes:**

1. Add `onOpenConversation?: () => void` to `SignalCardProps`.
2. Wire the "Open conversation" button `onClick`:

```tsx
// Before:
onClick={(e) => {
  e.stopPropagation();
  e.preventDefault();
}}

// After:
onClick={(e) => {
  e.stopPropagation();
  e.preventDefault();
  onOpenConversation?.();
}}
```

1. Disable the button (and show visual hint) when `!roomId` — the room hasn't been created yet for this signal.

**Verify:** Button calls callback when clicked. Does nothing (gracefully) when `roomId` is null.

---

### Step 5 — Thread `onSignalClick` Through `SignalGrid` and `SignalSection`

**Commit:** `feat(epics/coherence): thread signal-click callback through grid and section`

**Files:**
- `packages/epics/src/coherence/components/signal-grid.tsx`
- `packages/epics/src/coherence/components/signal-grid.container.tsx`
- `packages/epics/src/coherence/components/signal-section.tsx`

**Changes to `signal-grid.tsx`:**

1. Add `onSignalClick?: (signal: Coherence) => void` to `SignalGridProps`.
2. For non-archived signals: when `onSignalClick` is provided, render a `<button>` wrapper instead of `<Link>`. When not provided, keep `<Link>` as fallback.

```tsx
{signals.map((signal, index) =>
  signal.archived ? (
    <SignalCard key={...} {...signal} isLoading={isLoading} refresh={refresh} />
  ) : onSignalClick ? (
    <div
      key={...}
      role="button"
      tabIndex={0}
      className="text-left w-full"
      onClick={() => onSignalClick(signal)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSignalClick(signal);
        }
      }}
    >
      <SignalCard
        key={...}
        {...signal}
        isLoading={isLoading}
        refresh={refresh}
        onOpenConversation={() => onSignalClick(signal)}
      />
    </div>
  ) : (
    <Link key={...} href={`${basePath}/${signal.slug}`}>
      <SignalCard key={...} {...signal} isLoading={isLoading} refresh={refresh} />
    </Link>
  )
)}
```

**Changes to `signal-grid.container.tsx`:**
- Thread `onSignalClick?: (signal: Coherence) => void` prop through to `SignalGrid`.

**Changes to `signal-section.tsx`:**
- Thread `onSignalClick?: (signal: Coherence) => void` prop through to `SignalGridContainer`.
- Keep `basePath` prop as required (used as fallback when `onSignalClick` not provided).

**Verify:** Build passes. Callback is called on signal click when provided. Link navigation works when callback absent.

---

### Step 6 — Wire `CoherenceBlock` to Open Panel

**Commit:** `feat(epics/coherence): open human right panel on signal card click`

**File:** `packages/epics/src/coherence/components/coherence-block.tsx`

**Changes:**

1. Import `useHumanChatPanel` from `human-chat-panel-context`.
2. Import `useSidebar` from `@hypha-platform/ui`.
3. Implement `handleSignalClick`:

```tsx
const { openCoherenceChat } = useHumanChatPanel();
const { setOpen } = useSidebar();

const handleSignalClick = React.useCallback(
  (signal: Coherence) => {
    if (!signal.roomId) return; // guard: room not created yet
    openCoherenceChat(signal.roomId, signal.title, signal.slug);
    setOpen(true);
  },
  [openCoherenceChat, setOpen],
);
```

1. Pass `onSignalClick={handleSignalClick}` to `SignalSection`.
2. Keep `chatBasePath` prop on `SignalSection` (used as `<Link>` fallback in signal-grid when `onSignalClick` absent).

**Verify:** Clicking a signal card (with `roomId`) opens the right panel and loads that room. Panel header shows the conversation title. Back button returns to space chat. Closing the panel resets to space chat.

---

## Integration Checklist

After all steps:

- [ ] Clicking a signal opens the right panel in coherence mode
- [ ] Panel header shows conversation title + back button
- [ ] Clicking back returns to space chat mode
- [ ] Closing the panel (X button) resets to space chat mode
- [ ] Space chat still works when no signal is selected
- [ ] Signals without `roomId` show disabled "Open conversation" button
- [ ] No page navigation occurs when clicking a signal
- [ ] `pnpm nx run epics:build` passes
- [ ] `pnpm nx run web:build` passes

---

## Post-Integration Cleanup (Future)

After the integration is stable:

1. **Remove `@aside/coherence/chat/[slug]` route** — no longer needed. Signal cards no longer navigate there.
2. **Remove `chatBasePath` from `CoherenceBlock`** if no other component needs it.
3. **Add `pins` tab** to `HumanRightPanel` in coherence mode (currently only in `ChatDetail`).
4. **Message count sync** — coherence mode should also call `updateCoherenceBySlug({ messages: count })` when messages arrive (currently done in `ChatRoom`, needs porting to `HumanRightPanel` coherence mode).
5. **View count increment** — call `updateCoherenceBySlug({ views: views + 1 })` when coherence mode is entered (currently done in `ChatDetail`).

---

## Commands Reference

```bash
# Build packages incrementally
pnpm nx run epics:build
pnpm nx run web:build

# Type-check only (fast)
pnpm nx run epics:type-check

# Dev server
pnpm dev
```

---

## Related Documents

- [Coherence Chat Panel Research](./coherence-chat-panel-research.md) — architecture decisions
- [Coherence Incremental Plan](./coherence-incremental-plan.md) — base coherence screen build
- [Coherence Research](./coherence-research.md) — full coherence feature analysis
