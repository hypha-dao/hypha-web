---
title: "Coherence Chat → Human Right Panel — Architecture Research"
date: 2026-03-29
status: final
tags: [coherence, human-right-panel, matrix, architecture, research]
parent: docs/index.md
---

# Coherence Chat → Human Right Panel — Architecture Research

> Answers the five architecture questions needed before implementing the integration
> of coherence signal chats into the Human Right Panel sidebar.

---

## 1. System Overview

Two systems need to be joined:

| System | Current state |
|---|---|
| **Human Right Panel** | Renders once in root layout. Creates one Matrix room per DHO space. Uses `HumanChatPanelContext` (open/toggle only). |
| **Coherence Chat** | Each coherence record has a `roomId` (Matrix room). Signal cards are `<Link>` to `/coherence/chat/:slug`. `ChatDetail` manages its own Matrix lifecycle. |

The goal is: clicking a signal card **opens the right panel** and loads that signal's Matrix room into it — no page navigation.

**Attachments and org memory:** Files sent from Human Chat use Matrix media (`m.file` / `m.image`, `mxc://`); they are **not** the same store as proposal uploads (HTTPS on documents). A future **organisation-scoped catalogue** unifies visibility for search, AI, and UI such as *Space Memory* on the Coherence tab — see `docs/architecture/documents-and-media-overview.md` **§4** and [PR #2133](https://github.com/hypha-dao/hypha-web/pull/2133). Automatic catalogue writes from chat are **follow-up**; the chat UI only posts to Matrix.

---

## 2. Key File Inventory

### 2.1 Human Right Panel

| File | Role |
|---|---|
| `packages/epics/src/common/human-right-panel.tsx` | Top-level panel component. Manages Matrix room join, message state, send. Reads `spaceSlug` from `useParams`. |
| `packages/epics/src/common/human-chat-panel-context.tsx` | Context: `{ open, toggle }`. Shared by AI panel and Human panel triggers. |
| `packages/epics/src/common/human-chat-panel/human-chat-panel-header.tsx` | Shows title (default: i18n key), Hash icon, close button. Accepts `title?` and `description?` props. |
| `packages/epics/src/common/human-chat-panel/human-chat-panel-tabs.tsx` | Two tabs: `chat` and `members`. |
| `packages/epics/src/common/human-chat-panel/index.ts` | Barrel: exports all sub-components. |

### 2.2 Coherence Side

| File | Role |
|---|---|
| `packages/epics/src/coherence/components/coherence-block.tsx` | Client component. Fetches signals, computes `chatBasePath`, passes to `SignalSection`. |
| `packages/epics/src/coherence/components/signal-grid.tsx` | Wraps each active signal in `<Link href={basePath}/{signal.slug}>`. |
| `packages/epics/src/coherence/components/signal-card.tsx` | Signal card UI. Has "Open conversation" button stub with `e.preventDefault()` noop. Has `roomId` via `Coherence` spread. |
| `packages/epics/src/coherence/components/chat-detail.tsx` | Standalone full-screen chat panel. Manages join/listen/send itself. Used in `@aside` route (wrong target). |
| `packages/epics/src/coherence/components/chat-room.tsx` | Matrix room subscription + message list. Used by `ChatDetail`. |

### 2.3 Layout / Root

| File | Role |
|---|---|
| `apps/web/src/app/layout.tsx` | Renders `<HumanRightPanel />` inside `<PanelWrapLayout right={...}>` when `humanChatEnabled`. Panel is global — not per-route. |

---

## 3. Architecture Questions Resolved

### Q1 — Should we extend `HumanChatPanelContext` to carry `{ roomId, title, coherenceSlug }`?

**Decision: Yes.** The context is the correct single source of truth for what the panel is currently showing. It already decouples triggers from SidebarProvider nesting. Adding coherence state here means any component in the tree (SignalCard deep in CoherenceBlock) can call `openCoherenceChat()` without prop drilling.

**New shape:**

```ts
type PanelContextValue = {
  open: boolean;
  toggle: () => void;
};

type HumanChatPanelContextValue = {
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

> `AiPanelContext` is unaffected — it keeps the minimal `PanelContextValue`.

### Q2 — Should `HumanRightPanel` have two modes?

**Decision: Yes — `'space'` and `'coherence'`.** The panel already manages all Matrix state locally. The cleanest extension is to make it react to context mode:

- `mode === 'space'`: current behaviour (join/create `space-${spaceSlug}` room).
- `mode === 'coherence'`: join `coherenceRoomId` from context, skip local room creation. Show conversation title in header.

Both modes share the same message list, chat bar, tabs, and member list components. The only per-mode differences are the room to join and the header.

### Q3 — How should the panel header behave in coherence mode?

**Decision: Back button + conversation title.** `HumanChatPanelHeader` already accepts `title?` and `description?` props. Add an optional `onBack?: () => void` prop. When provided:

- Replace the `Hash` icon with an `ArrowLeft` icon (lucide-react).
- Clicking the icon calls `onBack()` (which calls `closeCoherenceChat()` → resets to `'space'` mode).
- Title shows the conversation name.

This keeps the header component generic — it doesn't need to know about coherence.

### Q4 — Should clicking a signal card prevent navigation and open the sidebar instead?

**Decision: Yes — intercept at `SignalGrid` level.**

Current flow:  
`SignalGrid` wraps each card in `<Link href={basePath}/{signal.slug}>` → navigation.

New flow:  
`SignalGrid` receives an `onSignalClick?: (signal: Coherence) => void` callback. When provided, it renders a `<button>` wrapper instead of `<Link>`. `CoherenceBlock` provides the callback: calls `openCoherenceChat(signal.roomId, signal.title, signal.slug)` and calls `useSidebar().setOpen(true)`.

The `SignalCard` "Open conversation" button is already a stub with `e.preventDefault()`. It can be wired to the same callback by adding `onOpenConversation?: () => void` prop.

**Archived cards** remain unwrapped (no link, no callback) — their unarchive action is separate.

### Q5 — What happens when the user closes the panel?

**Decision: Reset to space chat.** When the panel is closed (via the `PanelRightClose` button or `toggleSidebar`), the mode resets to `'space'` and `coherenceRoomId` is cleared. This is implemented by having `HumanRightPanel` listen to `useSidebar().open` and reset context when it becomes `false`.

Alternative considered — remember the coherence room — was rejected because:
- The panel may be closed mid-conversation and re-opened from a different page.
- Space chat is the "home" state; coherence rooms are transient selections.

---

## 4. Current Data Flow (Before Change)

```text
CoherenceBlock
  └─ SignalSection
       └─ SignalGrid
            └─ <Link href={basePath}/{slug}>   ← navigation
                 └─ SignalCard (no roomId access)

@aside/coherence/chat/[slug]/page.tsx
  └─ ChatDetail                                ← manages own Matrix room
       └─ ChatRoom (join + listen)
```

---

## 5. Target Data Flow (After Change)

```text
HumanChatPanelProvider (root layout)
  ├─ mode: 'space' | 'coherence'
  ├─ coherenceRoomId / coherenceTitle / coherenceSlug
  └─ openCoherenceChat(roomId, title, slug) / closeCoherenceChat()

CoherenceBlock
  └─ SignalSection
       └─ SignalGrid (onSignalClick callback)
            └─ <button onClick={onSignalClick(signal)}>   ← NO navigation
                 └─ SignalCard
                      └─ openCoherenceChat() + sidebar.setOpen(true)

HumanRightPanel (root layout, always mounted)
  ├─ mode === 'space' → join space-${spaceSlug} room (current behaviour)
  └─ mode === 'coherence' → join coherenceRoomId from context
       └─ HumanChatPanelHeader (title=coherenceTitle, onBack=closeCoherenceChat)
            └─ ArrowLeft icon → back to space chat
```

---

## 6. Component Change Summary

| Component | Change |
|---|---|
| `human-chat-panel-context.tsx` | Extend `HumanChatPanelContextValue` with mode + coherence fields + actions. Provide state in `HumanChatPanelProvider`. |
| `human-right-panel.tsx` | Read `mode`, `coherenceRoomId`, `coherenceTitle` from context. Switch room logic on mode. Reset on sidebar close. |
| `human-chat-panel-header.tsx` | Add `onBack?: () => void` prop. Render `ArrowLeft` icon + back behaviour. |
| `signal-grid.tsx` | Add `onSignalClick?: (signal: Coherence) => void`. Replace `<Link>` with `<button>` wrapper when callback present. |
| `signal-section.tsx` | Thread `onSignalClick` from `CoherenceBlock` down through `SignalGridContainer` → `SignalGrid`. |
| `coherence-block.tsx` | Import `useHumanChatPanel` + `useSidebar`. Provide `onSignalClick` callback that calls `openCoherenceChat` + opens sidebar. |
| `signal-card.tsx` | Add `onOpenConversation?: () => void`. Wire "Open conversation" button. |

---

## 7. What Does NOT Change

- `ChatDetail`, `ChatRoom`, `ChatMessageInput` — still used for the `@aside` route; untouched.
- `AiPanelContext` — unaffected.
- `PanelWrapLayout`, root `layout.tsx` — no changes needed.
- `HumanChatPanelTabs`, `HumanChatPanelMessages`, `HumanChatPanelChatBar`, `HumanChatPanelMembers` — no changes needed.
- Space chat functionality — preserved as `mode === 'space'` default.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `coherenceRoomId` may be null (room not yet created for new signals) | Guard in `openCoherenceChat`: only open if `roomId` is truthy. Show error toast or disable "Open" button if null. |
| Race condition: user opens two signals quickly | `HumanRightPanel` tracks `joinedRoomId` ref and unregisters previous listener before joining new room. |
| Panel mounted before `spaceSlug` is available (root layout) | Space-mode room join already guards on `!spaceSlug`. No change needed. |
| Coherence module not yet fully built | Context extension is independent of coherence components — can be done in parallel with Step 8–12 of the incremental plan. |
| `useSidebar()` in `CoherenceBlock` requires SidebarProvider ancestor | `CoherenceBlock` renders inside PanelWrapLayout which provides SidebarProvider. No issue. |

---

## 9. Related Documents

- [Coherence Screen Research](./coherence-research.md) — full coherence feature analysis
- [Coherence Incremental Plan](./coherence-incremental-plan.md) — step-by-step coherence screen build
- [Coherence Chat Panel Plan](./coherence-chat-panel-plan.md) — implementation steps for this integration
