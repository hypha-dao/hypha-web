---
title: "Coherence Screen — Incremental Implementation Plan"
date: 2026-03-28
status: final
tags: [coherence, implementation, plan, incremental]
parent: docs/index.md
---

# Coherence Screen — Incremental Implementation Plan

> Implements the coherence screen on `feat/panel-header` following the reference
> at `litzi/feat/presentation-coherence-screen-and-ai-panel`.  
> See [coherence-research.md](./coherence-research.md) for full analysis.

---

## Guiding Principles

- **Bottom-up order**: storage → core types → core server → core client → epics → routes → nav → i18n
- **Each step = one conventional commit** that leaves the codebase in a buildable state
- **E2E tests** are written TDD-style before implementation and drive the final integration
- **No breaking changes** to existing tabs; coherence is purely additive

---

## Dependency Graph

```text
Step 1: storage schema
   ↓
Step 2: core types + validation
   ↓
Step 3: core server (queries + mutations + actions)
   ↓
Step 4: core server web3 adapters
   ↓
Step 5: core client hooks
   ↓
Step 6: core index wiring (client.ts)
   ↓
Step 7: epics types + primitive buttons
   ↓
Step 8: epics signal components (card, grid, section)
   ↓
Step 9: epics conversation components (card, grid, section)
   ↓
Step 10: epics chat components (room, message, input, detail)
   ↓
Step 11: epics create-signal form
   ↓
Step 12: epics coherence-block (top-level wiring)
   ↓
Step 13: epics index wiring
   ↓
Step 14: i18n translations
   ↓
Step 15: route files (@tab/coherence, @aside/coherence)
   ↓
Step 16: navigation tab + layout.tsx cleanup
   ↓
[E2E tests pass — feature complete]
```

---

## Steps

### Step 1 — Storage: Coherence Schema

**Commit:** `feat(storage): add coherence table schema`  
**Files:**
- `packages/storage-postgres/src/schema/coherence.ts` (new)
- `packages/storage-postgres/src/schema/coherence-types.ts` (new)
- `packages/storage-postgres/src/schema/coherence-priorities.ts` (new)
- `packages/storage-postgres/src/schema/coherence-statuses.ts` (new)
- `packages/storage-postgres/src/schema/coherence-tags.ts` (new)
- `packages/storage-postgres/src/schema/index.ts` (modify: import coherences, add to schema, re-export)

**Verification:** `pnpm nx run storage-postgres:build` passes.

**Key notes:**
- `coherences` table has `spaceId` foreign key to `spaces.id`
- `tags` is `jsonb` column, not a separate table
- GIN full-text index on `title + description`
- A DB migration must be generated: `pnpm nx run storage-postgres:generate` and applied

---

### Step 2 — Core: Types, Enums & Validation

**Commit:** `feat(core/coherence): add types, enums and zod validation`  
**Files:**
- `packages/core/src/coherence/types.ts` (modify: add Coherence, CreateCoherenceInput, UpdateCoherenceInput types)
- `packages/core/src/coherence/coherence-types.ts` (new: COHERENCE_TYPES + COHERENCE_TYPE_OPTIONS with icon/colorVariant)
- `packages/core/src/coherence/coherence-priorities.ts` (new: COHERENCE_PRIORITIES + COHERENCE_PRIORITY_OPTIONS)
- `packages/core/src/coherence/coherence-tags.ts` (new: COHERENCE_TAGS — 8 tags)
- `packages/core/src/coherence/validation.ts` (new: zod schemas for create form and server action)

**Verification:** TypeScript compiles. No runtime deps.

---

### Step 3 — Core: Server Queries & Mutations

**Commit:** `feat(core/coherence): add server queries and mutations`  
**Files:**
- `packages/core/src/coherence/server/mutations.ts` (new)
- `packages/core/src/coherence/server/queries.ts` (new)

**Verification:** `pnpm nx run core:build` passes. Unit-testable in isolation.

**Key notes:**
- `createCoherence`: requires creatorId + spaceId, auto-generates slug if not provided
- `findAllCoherences`: full filter/search/sort support; returns `[]` for undefined `spaceId`
- `updateCoherenceBySlug` / `deleteCoherenceBySlug`: operate on slug, throw on not found

---

### Step 4 — Core: Server Actions & Web3 Adapters

**Commit:** `feat(core/coherence): add server actions and web3 adapters`  
**Files:**
- `packages/core/src/coherence/server/actions.ts` (new: `'use server'` wrappers)
- `packages/core/src/coherence/server/web3/get-all-coherences.ts` (new)
- `packages/core/src/coherence/server/web3/get-coherence-by-slug.ts` (new)
- `packages/core/src/coherence/server/web3/index.ts` (new)
- `packages/core/src/coherence/server/index.ts` (new: barrel)
- `packages/core/src/coherence/server.ts` (delete: was `export * from './lib'`, now superseded)

**Verification:** Build passes. Server actions are callable from client via `'use server'`.

**Key notes:**
- `getAllCoherences` maps raw DB rows to typed `Coherence` domain objects
- `getCoherenceBySlug` returns `undefined` for not-found (not null)

---

### Step 5 — Core: Client Hooks

**Commit:** `feat(core/coherence): add client SWR hooks`  
**Files:**
- `packages/core/src/coherence/client/hooks/useFindCoherences.ts` (new)
- `packages/core/src/coherence/client/hooks/useCoherenceMutations.web2.rsc.ts` (new)
- `packages/core/src/coherence/client/hooks/index.ts` (new)
- `packages/core/src/coherence/client/index.ts` (new)

**Verification:** Build passes. Hooks are importable but don't render yet.

**Key notes:**
- `useFindCoherences`: polls every 5s, requires `spaceId` to fetch (noop if undefined)
- `useCoherenceMutationsWeb2Rsc`: requires `authToken` for create; update/delete work without (RLS TODO)

---

### Step 6 — Core: Wire Coherence into `client.ts` and `coherence/index.ts`

**Commit:** `feat(core): export coherence module from client barrel`  
**Files:**
- `packages/core/src/client.ts` (modify: add `export * from './coherence'`)
- `packages/core/src/coherence/index.ts` (modify: expand exports to client, validation, enums)

**Verification:** `pnpm nx run core:build` — all exports resolve correctly. `@hypha-platform/core/client` now exposes coherence hooks and types.

---

### Step 7 — Epics: Types & Primitive Buttons

**Commit:** `feat(epics/coherence): add types and primitive UI buttons`  
**Files:**
- `packages/epics/src/coherence/types.ts` (new: ChatCreatorType, COHERENCE_ORDERS, CoherenceOrder, ChatPageParams)
- `packages/epics/src/coherence/components/coherence-type-button.tsx` (new)
- `packages/epics/src/coherence/components/coherence-priority-button.tsx` (new)

**Verification:** Build passes. Buttons are pure presentational components.

---

### Step 8 — Epics: Signal Components

**Commit:** `feat(epics/coherence): add signal card, grid and section components`  
**Files:**
- `packages/epics/src/coherence/components/signal-card.tsx` (new)
- `packages/epics/src/coherence/components/signal-grid.tsx` (new)
- `packages/epics/src/coherence/components/signal-grid.container.tsx` (new)
- `packages/epics/src/coherence/hooks/use-signals-section.ts` (new)

**Verification:** Build passes. Components render with mock data.

**Key notes:**
- `SignalCard`: type badge + priority dot + tags + archive/unarchive action
- `SignalGrid`: responsive 1→2→3 col layout, archived cards not wrapped in `<Link>`
- `SignalGridContainer`: pure pagination slice (no data fetching)
- `useSignalsSection`: client-side pagination + debounced search (300ms)

---

### Step 9 — Epics: Conversation Components

**Commit:** `feat(epics/coherence): add conversation card, grid and section components`  
**Files:**
- `packages/epics/src/coherence/components/conversation-card.tsx` (new)
- `packages/epics/src/coherence/components/conversation-grid.tsx` (new)
- `packages/epics/src/coherence/components/conversation-grid.container.tsx` (new)
- `packages/epics/src/coherence/hooks/use-conversations-section.ts` (new)

**Verification:** Build passes.

**Key notes:**
- `ConversationCard`: inline message input (Matrix send), archive/unarchive confirm dialog
- 1→2 col grid; archived cards not linked
- `useConversationsSection`: mirrors signal section pagination pattern

---

### Step 10 — Epics: Chat Components

**Commit:** `feat(epics/coherence): add chat room, message and detail components`  
**Files:**
- `packages/epics/src/coherence/components/chat-message.tsx` (new)
- `packages/epics/src/coherence/components/chat-message.container.tsx` (new)
- `packages/epics/src/coherence/components/chat-room.tsx` (new)
- `packages/epics/src/coherence/components/chat-head.tsx` (new)
- `packages/epics/src/coherence/components/chat-message-input.tsx` (new)
- `packages/epics/src/coherence/components/chat-detail.tsx` (new)
- `packages/epics/src/coherence/hooks/use-conversation.ts` (new)

**Verification:** Build passes.

**Key notes:**
- `ChatRoom`: joins Matrix room, registers live listener, updates message count on coherence
- `ChatDetail`: fixed sticky header + footer, scrollable message list; auto-increments `views`
- `use-conversation.ts`: fix relative import (`../../../../core/src/...`) → use `@hypha-platform/core/server`
- `ChatMessageInput`: archive button (with confirm dialog) + "Propose Agreement" stub

---

### Step 11 — Epics: Create Signal Form

**Commit:** `feat(epics/coherence): add create signal form`  
**Files:**
- `packages/epics/src/coherence/components/create-signal-form.tsx` (new)

**Verification:** Build passes. Form renders and validates.

**Key notes:**
- Full zod + react-hook-form integration with `schemaCreateCoherenceForm`
- Three-phase on submit: `createCoherence` → `createRoom` → `updateCoherenceBySlug({ roomId })`
- `LoadingBackdrop` with progress (0 → 50 → 100)

---

### Step 12 — Epics: CoherenceBlock (Top-Level)

**Commit:** `feat(epics/coherence): add coherence-block top-level component`  
**Files:**
- `packages/epics/src/coherence/components/coherence-block.tsx` (new)

**Verification:** Build passes. `CoherenceBlock` is the main exported entry point.

**Key notes:**
- Client component, uses `useAuthentication()` to gate display
- Computes `chatBasePath` as `/${lang}/dho/${spaceSlug}/coherence/chat`
- Passes `refresh` callback through the signal hierarchy

---

### Step 13 — Epics: Barrel Exports

**Commit:** `feat(epics/coherence): wire coherence module into epics barrel`  
**Files:**
- `packages/epics/src/coherence/components/index.ts` (new: export all 14 components)
- `packages/epics/src/coherence/hooks/index.ts` (new: export 3 hooks)
- `packages/epics/src/coherence/index.ts` (new: components + hooks + types)
- `packages/epics/src/index.ts` (modify: add `export * from './coherence'`)

**Verification:** `pnpm nx run epics:build` — all exports resolve. `@hypha-platform/epics` now exposes `CoherenceBlock`, `CoherenceOrder`, `COHERENCE_ORDERS`.

---

### Step 14 — i18n: Translations

**Commit:** `feat(i18n): add CoherenceTab translations and Common.Coherence key`  
**Files:**
- `packages/i18n/src/messages/en.json` (modify: add CoherenceTab namespace + `"Coherence"` to Common)
- `packages/i18n/src/messages/de.json` (modify: add CoherenceTab + Common.Coherence)
- `packages/i18n/src/messages/es.json` (modify: add CoherenceTab + Common.Coherence)
- `packages/i18n/src/messages/fr.json` (modify: add CoherenceTab + Common.Coherence)
- `packages/i18n/src/messages/pt.json` (modify: add CoherenceTab + Common.Coherence)

**Verification:** `pnpm nx run i18n:build`. Non-English locales may use English values as placeholders for now.

**Key CoherenceTab keys:** signals, signInToSee, searchSignals, improve, newSignal, all, listIsEmpty, mostViews, mostMessages, mostRecent, searchConversation, hideArchived, highUrgency, mediumUrgency, lowUrgency, mentions, unarchive*, archive*, propose*, error*, types.*, typeDescriptions.*, priorities.*, priorityDescriptions.* (see research doc for full list)

---

### Step 15 — Routes: `@tab/coherence` and `@aside/coherence`

**Commit:** `feat(web/coherence): add coherence tab and aside route files`  
**Files:**
- `apps/web/src/app/[lang]/dho/[id]/@tab/coherence/constants.ts` (new)
- `apps/web/src/app/[lang]/dho/[id]/@tab/coherence/page.tsx` (new)
- `apps/web/src/app/[lang]/dho/[id]/@tab/coherence/default.tsx` (new)
- `apps/web/src/app/[lang]/dho/[id]/@tab/coherence/error.tsx` (new)
- `apps/web/src/app/[lang]/dho/[id]/@aside/coherence/page.tsx` (new)
- `apps/web/src/app/[lang]/dho/[id]/@aside/coherence/default.tsx` (new)

**Verification:** `pnpm nx run web:build`. Navigate to `/en/dho/<space-slug>/coherence` — page renders.

**Key notes:**
- `page.tsx` reads `searchParams.order` and validates against `COHERENCE_ORDERS`; defaults to `'mostrecent'`
- `@aside/coherence/page.tsx` returns `null` (stub for future aside panel)

---

### Step 16 — Navigation & Layout Integration

**Commit:** `feat(web/coherence): add coherence to navigation tabs`  
**Files:**
- `apps/web/src/app/[lang]/dho/[id]/_components/navigation-tabs.tsx` (modify: import getDhoPathCoherence, add tab)
- `apps/web/src/app/[lang]/dho/[id]/layout.tsx` (modify: remove getFormatter, use formatDate)

**Verification:** Dev server runs. Coherence tab appears in DHO navigation. Clicking navigates to coherence page.

**Key notes:**
- Coherence tab inserted **before** Agreements in the tab array
- `t('Coherence')` references `Common.Coherence` i18n key (added in Step 14)

---

## E2E Checkpoints

E2E tests should be written before implementation begins (TDD), live at `apps/web-e2e/src/coherence.spec.ts`, and progressively pass as steps complete:

| Test | Passes after step |
|---|---|
| Coherence tab appears in navigation | Step 16 |
| Clicking coherence tab navigates to correct URL | Step 16 |
| Coherence page renders (not auth-gated) | Step 15 |
| "Sign in to see" message shown when unauthenticated | Step 12 |
| Signal section renders with loading skeletons | Step 8 + 12 + 15 |
| Signal type filter badges are displayed | Step 8 + 12 |
| "New Signal" button is visible | Step 8 + 12 |
| Search input filters signals | Step 8 + 12 |
| Navigate to new-signal form | Step 11 + 15 |
| Submit create signal form | Step 11 + 15 |

---

## Post-Implementation Cleanup

After all E2E tests pass, consider:

1. **Fix `use-conversation.ts` import** — replace relative `../../../../core/src/...` with `@hypha-platform/core/server`
2. **Wire ConversationSection** — `CoherenceBlock` currently only shows signals; conversations can be added as a second section
3. **Space Memory / org memory UI** — implementation checklist and acceptance criteria: **`docs/plans/space-memory-panel.md`**. V1: derive from existing `documents` API (no new tables). V2: **org-scoped asset catalogue** per `docs/architecture/documents-and-media-overview.md` **§4**. Chat attachment semantics: `docs/architecture/space-chat-attachments.md`. Automatic Matrix catalogue ingestion is **follow-up** to chat attachments on `main` ([PR #2133](https://github.com/hypha-dao/hypha-web/pull/2133)); proposal catalogue registration can lead (§4.5).
4. **RLS policies** — implement authToken-based row-level security for update/delete (#602)
5. **Non-English translations** — replace placeholder en strings with proper translations
6. **New signal / chat routes** — create `@tab/coherence/new-signal/` and `@tab/coherence/chat/[chatId]/` route files (not in current reference diff but implied by component hrefs)

---

## Commands Reference

```bash
# Build individual packages
pnpm nx run storage-postgres:build
pnpm nx run core:build
pnpm nx run epics:build
pnpm nx run web:build

# Generate DB migration (after schema changes)
pnpm nx run storage-postgres:generate

# Run all E2E tests
pnpm nx run web-e2e:e2e

# Run specific E2E test file
pnpm nx run web-e2e:e2e --spec=coherence.spec.ts

# Dev server
pnpm dev
```
