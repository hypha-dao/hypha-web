# Chat Signals AI Prototype Parity Specification

## 1. Purpose

Define the **exact feature set** and **page structure** to replicate from the early Chat Signals AI prototype, while implementing visuals using the **current app component system**.

This document is a parity contract (what to match now), not a redesign specification.

## 2. Baseline Sources

The exact `webguru-hypha/chat-signals-ai` ref is not available in current remote refs.  
Parity baseline is derived from the prototype lineage that is present in this repository:

- `origin/feat/1908-coherence-screen-and-chats`
- `origin/feat/1957-ai-left-panel`
- `origin/feat/1958-ai-left-panel-ui-elements`
- `origin/feat/1969-ai-left-panel-ai-integration`
- `origin/feat/1969-ai-left-panel-extend-chat-bar-with-multimodal-input`
- `origin/feat/rebased/presentation-coherence-screen-and-ai-panel` (consolidated)

## 3. Core Delivery Rule

- **PAR-1:** Implementation MUST preserve the same functional scope and information architecture as the prototype baseline.
- **PAR-2:** Implementation MUST preserve page/route structure and interaction flow of the prototype baseline.
- **PAR-3:** Implementation MUST use current app component primitives/design system already in this codebase (no separate design fork in this phase).

## 4. Feature Parity Inventory

### 4.1 Left AI panel (global shell behavior)

Must match:

1. Left panel visible by default on desktop.
2. Desktop panel can be resized by drag handle.
3. Panel can be collapsed and reopened by a floating left-edge button.
4. Mobile uses left-side drawer behavior.

Prototype evidence:

- `packages/epics/src/common/ai-left-panel-layout.tsx`
- `apps/web/src/app/layout.tsx` (global placement)

### 4.2 AI panel chat behavior

Must match:

1. Auth-gated experience:
   - loading state
   - signed-out "Sign in to use Hypha AI"
2. Header controls:
   - model dropdown
   - reset chat
   - close panel
3. Messages area:
   - default welcome assistant message when empty
   - suggestion buttons shown early in session
4. Input area:
   - text entry with Enter-to-send, Shift+Enter newline
   - send and stop streaming controls
   - voice input toggle
   - code block insertion action
   - attachment preview UI
5. Chat transport to `/api/chat` using Vercel AI SDK.

Prototype evidence:

- `packages/epics/src/common/ai-left-panel.tsx`
- `packages/epics/src/common/ai-panel/ai-panel-header.tsx`
- `packages/epics/src/common/ai-panel/ai-panel-messages.tsx`
- `packages/epics/src/common/ai-panel/ai-panel-suggestions.tsx`
- `packages/epics/src/common/ai-panel/ai-panel-chat-bar.tsx`
- `apps/web/src/app/api/chat/route.ts`

### 4.3 Coherence tab page behavior

Must match:

1. `Coherence` tab available in DHO navigation.
2. Signals section with:
   - search input
   - type badges/filters (All + coherence types + counts)
   - "Improve" button shown (disabled in prototype)
   - "New Signal" button
   - paginated grid and load-more behavior
3. Signal cards display:
   - type badge
   - urgency/priority
   - title + description preview
   - mentions count
   - tags
   - open conversation action
   - archive/unarchive behavior

Prototype evidence:

- `apps/web/src/app/[lang]/dho/[id]/_components/navigation-tabs.tsx`
- `apps/web/src/app/[lang]/dho/[id]/@tab/coherence/page.tsx`
- `packages/epics/src/coherence/components/coherence-block.tsx`
- `packages/epics/src/coherence/components/signal-section.tsx`
- `packages/epics/src/coherence/components/signal-grid.tsx`
- `packages/epics/src/coherence/components/signal-card.tsx`

### 4.4 Signal creation flow

Must match:

1. "New Signal" opens right side panel route.
2. Create form includes:
   - title
   - type
   - priority
   - tags
   - description
3. On publish:
   - coherence entry created
   - matrix room created
   - coherence updated with room id
   - user redirected back to coherence page

Prototype evidence:

- `apps/web/src/app/[lang]/dho/[id]/@aside/[tab]/new-signal/page.tsx`
- `packages/epics/src/coherence/components/create-signal-form.tsx`

### 4.5 Conversation detail side panel

Must match:

1. Clicking a signal opens chat detail in right side panel route.
2. Top fixed header area:
   - creator identity
   - created date
   - close action
3. Middle area:
   - signal title + description
   - live message list
4. Bottom fixed composer area:
   - archive conversation action
   - propose agreement action (placeholder in prototype)
   - message input with send-on-enter
5. Matrix-backed message retrieval/listening and send behavior.

Prototype evidence:

- `apps/web/src/app/[lang]/dho/[id]/@aside/[tab]/chat/[chatId]/page.tsx`
- `packages/epics/src/common/side-panel.tsx`
- `packages/epics/src/coherence/components/chat-detail.tsx`
- `packages/epics/src/coherence/components/chat-room.tsx`
- `packages/epics/src/coherence/components/chat-message.container.tsx`
- `packages/epics/src/coherence/components/chat-message-input.tsx`

### 4.6 Chat API behavior

Must match:

1. Auth token required (`Authorization` header) for chat endpoint.
2. Model selection by `modelId`.
3. Streaming text response.
4. System prompt framed as Hypha assistant for signals/proposals/community coordination.

Prototype evidence:

- `apps/web/src/app/api/chat/route.ts`

## 5. Page Structure Contract (Route-Level)

Must preserve this structure:

1. **Global app shell**
   - left AI panel wrapper at root app layout
2. **DHO tab page**
   - coherence page at `/[lang]/dho/[id]/coherence`
3. **DHO right side-panel routes**
   - signal creation: `/[lang]/dho/[id]/coherence/new-signal`
   - conversation detail: `/[lang]/dho/[id]/coherence/chat/[chatId]`

Prototype evidence:

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/[lang]/dho/[id]/@tab/coherence/constants.ts`
- `apps/web/src/app/[lang]/dho/[id]/@aside/[tab]/new-signal/page.tsx`
- `apps/web/src/app/[lang]/dho/[id]/@aside/[tab]/chat/[chatId]/page.tsx`

## 6. UI Composition Contract (Region-Level)

### 6.1 Left panel regions

1. Header (title/model/reset/close)
2. Scrollable messages + suggestions
3. Chat bar footer with controls

### 6.2 Coherence tab regions

1. Filter + search row
2. Type badge row
3. Signal card grid
4. Load-more footer

### 6.3 Right chat side panel regions

1. Fixed top metadata header
2. Scrollable conversation context + messages
3. Fixed bottom action/composer bar

## 7. Explicit Non-Goals for This Phase

1. Visual redesign beyond current app components.
2. Changing information architecture of tabs/routes/panel flows.
3. Expanding scope beyond prototype feature set.

## 8. Acceptance Criteria

- **AC-PAR-1:** All parity features in Section 4 are present and interact in the same user flow order as prototype.
- **AC-PAR-2:** Route/page structure in Section 5 is preserved.
- **AC-PAR-3:** Current app component primitives are used for implementation.
- **AC-PAR-4:** Placeholder/disabled actions that exist in prototype remain clearly represented unless explicitly upgraded in a later scope.
- **AC-PAR-5:** Left panel and right side panel can coexist without breaking DHO navigation flow.

## 9. Relationship to Other Requirement Docs

This spec defines the **MVP parity baseline**.

Any enhancements (deeper context retrieval, richer multimodal ingestion, advanced signal synthesis, redesign) should be added as follow-up increments on top of this parity baseline.
