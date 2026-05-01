---
title: "Coherence Screen — Reference Implementation Research"
date: 2026-03-28
status: final
tags: [coherence, research, architecture, reference-implementation]
parent: docs/index.md
---

# Coherence Screen — Reference Implementation Research

> Analysis of `litzi/feat/presentation-coherence-screen-and-ai-panel` (fetched as `FETCH_HEAD`).  
> Target branch: `feat/panel-header`.

---

## 1. Overview

The coherence screen introduces a new DHO tab that surfaces **organisational health signals** — typed, prioritised cards that feed into threaded Matrix-backed chat conversations. It adds four new layers to the monorepo stack:

| Layer | Package | What changes |
|---|---|---|
| Storage | `packages/storage-postgres` | `coherences` table + schema enums |
| Core | `packages/core/src/coherence/` | Types, CRUD actions, SWR hooks, server queries, web3 adapters |
| Epics | `packages/epics/src/coherence/` | All UI components (signal cards, conversation cards, forms, chat) |
| Routes | `apps/web/src/app/[lang]/dho/[id]/` | `@tab/coherence` + `@aside/coherence` parallel routes, nav update |

---

## 2. Storage Layer — `packages/storage-postgres`

### 2.1 New Schema Files

| File | Purpose |
|---|---|
| `src/schema/coherence.ts` | Drizzle `coherences` table definition |
| `src/schema/coherence-types.ts` | `COHERENCE_TYPES` const array (15 values) |
| `src/schema/coherence-priorities.ts` | `COHERENCE_PRIORITIES` const array (`high`, `medium`, `low`) |
| `src/schema/coherence-statuses.ts` | `COHERENCE_STATUSES` const array (`signal`, `conversation`) |
| `src/schema/coherence-tags.ts` | `COHERENCE_TAGS` const array (27 categorised tags) |

### 2.2 Table: `coherences`

```ts
coherences = pgTable('coherences', {
  id:          serial().primaryKey(),
  creatorId:   integer('creator_id').notNull(),
  spaceId:     integer('space_id').references(() => spaces.id),
  title:       text().notNull(),
  description: text().notNull(),
  type:        text().notNull(),          // CoherenceType
  priority:    text().default('medium'),  // CoherencePriority
  slug:        varchar({ length: 255 }),
  roomId:      text(),                   // Matrix room ID
  archived:    boolean().default(false),
  views:       integer().default(0),
  messages:    integer().default(0),
  tags:        jsonb().$type<string[]>().default([]),
  ...commonDateFields,                   // createdAt, updatedAt
}, (table) => [
  // GIN full-text index on title + description
  // Indexes on type, priority, slug, roomId, archived, views, messages, tags
])
```

**Key design decisions:**
- `roomId` is the Matrix room identifier; set after room creation (two-phase write)
- `tags` is stored as `jsonb` (array) — not a normalised join table
- GIN full-text index enables fast `plainto_tsquery` search with ILIKE fallback
- No DB enum types — `type` and `priority` are plain `text` columns

### 2.3 `schema/index.ts` Changes

- Add `coherence.ts` import + `coherences` to schema object
- Re-export `coherences` table and type via `export * from './coherence'`

> **Note:** The `coherence-types.ts` / `coherence-priorities.ts` / `coherence-tags.ts` / `coherence-statuses.ts` files are schema constants only — they do **not** create DB tables.

---

## 3. Core Layer — `packages/core/src/coherence/`

### 3.1 File Tree (reference)

```
packages/core/src/coherence/
├── index.ts                          # re-exports all sub-modules
├── types.ts                          # Coherence, CreateCoherenceInput, UpdateCoherenceInput types
├── coherence-types.ts                # COHERENCE_TYPES + COHERENCE_TYPE_OPTIONS (6 types + icon/color metadata)
├── coherence-priorities.ts           # COHERENCE_PRIORITIES + COHERENCE_PRIORITY_OPTIONS (high/medium/low)
├── coherence-tags.ts                 # COHERENCE_TAGS (8 simplified tags: Strategy, Culture…)
├── validation.ts                     # Zod schemas: schemaCreateCoherenceForm, schemaCreateCoherenceWeb2
├── lib/                              # Existing environment utils (unchanged)
│   ├── determine-environment.ts
│   ├── get-prefix-by-environment.ts
│   └── matrix-shared-secret.ts
├── client/
│   ├── index.ts                      # Barrel for client-side exports
│   └── hooks/
│       ├── index.ts
│       ├── useFindCoherences.ts      # SWR hook → getAllCoherences (web3/server action)
│       └── useCoherenceMutations.web2.rsc.ts  # SWR mutation hooks (create/update/delete)
└── server/
    ├── index.ts                      # Barrel for server exports
    ├── actions.ts                    # Next.js Server Actions (create/update/delete)
    ├── mutations.ts                  # Low-level DB mutations via Drizzle
    ├── queries.ts                    # DB queries: findAll, findById, findBySlug, checkSlugExists
    └── web3/
        ├── index.ts
        ├── get-all-coherences.ts     # Server Action wrapping findAllCoherences
        └── get-coherence-by-slug.ts  # Server Action wrapping findCoherenceBySlug
```

> **Note:** The existing `server.ts` file at `packages/core/src/coherence/server.ts` is **deleted** (was only `export * from './lib'`). Server exports now live in `server/index.ts`.

### 3.2 Type Definitions (`types.ts`)

```ts
// Input types
interface CreateCoherenceInput { creatorId, spaceId, type, priority, title, description, slug?, roomId?, archived, tags, messages?, views? }
interface UpdateCoherenceInput { slug?, archived?, roomId?, messages?, views? }
type UpdateCoherenceBySlugInput = { slug: string } & UpdateCoherenceInput

// Domain entity
type Coherence = { id, creatorId?, createdAt, updatedAt, type: CoherenceType, priority: CoherencePriority, title, description, slug, roomId?, archived, tags: CoherenceTag[], messages?, views? }

// Environment enum (pre-existing)
enum Environment { DEVELOPMENT, PREVIEW, PRODUCTION }
```

### 3.3 Coherence Types vs Storage Types

| Location | Types | Purpose |
|---|---|---|
| `coherence-types.ts` (core) | 6 types: Opportunity, Risk, Tension, Insight, Trend, Proposal | UI display — with icon + colorVariant metadata |
| `coherence-types.ts` (storage) | 15 types: Opportunity, Tension, Risk, Strategy, Innovation… | DB enum values (superset) |

> The core-level type list is the **UI-visible subset** used for signal creation and display. The storage level is more permissive for future extensibility.

### 3.4 `useFindCoherences` Hook

```ts
useFindCoherences({ spaceId?, search?, type?, tags?, priority?, includeArchived?, orderBy? })
// → SWR polling every 5 seconds (refreshInterval: 5000)
// → calls getAllCoherences server action
// → returns { coherences, isLoading, error, refresh }
```

### 3.5 `useCoherenceMutationsWeb2Rsc` Hook

```ts
useCoherenceMutationsWeb2Rsc(authToken?)
// → SWR mutations for: createCoherence, updateCoherenceBySlug, deleteCoherenceBySlug
// → each returns: trigger fn, reset fn, isMutating, error, data
```

### 3.6 Server Actions (`server/actions.ts`)

- `createCoherenceAction(data, { authToken })` — authToken required
- `updateCoherenceBySlugAction(data, { authToken })` — RLS TODO #602 (authToken ignored currently)
- `deleteCoherenceBySlugAction(data, { authToken })` — RLS TODO #602

### 3.7 Query Capabilities (`server/queries.ts`)

`findAllCoherences` supports:
- Filter by `spaceId` (required — returns `[]` if undefined)
- Full-text search (GIN tsvector + ILIKE fallback)
- Filter by `type`, `tags` (arrayOverlaps), `priority`
- `includeArchived` flag (default: false)
- `orderBy` switch: `mostrecent` (default), `mostmessages`, `mostviews`

### 3.8 `core/src/client.ts` Change

```diff
+ export * from './coherence';
```

### 3.9 `core/src/server.ts` (pre-existing)

Already exports `export * from './coherence/server'` and `export * from './coherence/types'` — these entries are already present in the current branch (`server.ts` was updated in an earlier commit).

---

## 4. Epics Layer — `packages/epics/src/coherence/`

### 4.1 File Tree

```
packages/epics/src/coherence/
├── index.ts               # Barrel: components + hooks + types
├── types.ts               # ChatCreatorType, COHERENCE_ORDERS, CoherenceOrder, ChatPageParams
├── components/
│   ├── index.ts
│   ├── coherence-block.tsx          # Top-level client component (renders SignalSection)
│   ├── signal-section.tsx           # Filter + pagination + type-badge row + grid
│   ├── signal-grid.tsx              # Responsive 1→2→3 col grid
│   ├── signal-grid.container.tsx    # Pagination slice → SignalGrid
│   ├── signal-card.tsx              # Individual signal card (type badge, priority dot, tags)
│   ├── conversation-section.tsx     # Conversations with archive toggle + order combobox
│   ├── conversation-grid.tsx        # 1→2 col grid
│   ├── conversation-grid.container.tsx
│   ├── conversation-card.tsx        # Conversation card with inline message input
│   ├── chat-detail.tsx              # Full chat panel (fixed header/footer, scrollable messages)
│   ├── chat-head.tsx                # Creator avatar + name + date
│   ├── chat-room.tsx                # Matrix room join/listen, message list
│   ├── chat-message.tsx             # Single message with avatar
│   ├── chat-message.container.tsx   # Loading skeleton + message list
│   ├── chat-message-input.tsx       # Send message + archive button + propose agreement
│   ├── create-signal-form.tsx       # Full signal creation form (zod + react-hook-form)
│   ├── coherence-type-button.tsx    # Card-style type selector button
│   └── coherence-priority-button.tsx # Card-style priority selector button
└── hooks/
    ├── index.ts
    ├── use-conversation.ts          # SWR hook → getCoherenceBySlug
    ├── use-conversations-section.ts # Pagination + search for conversations list
    └── use-signals-section.ts       # Pagination + search for signals list
```

### 4.2 Component Data Flow

```
CoherencePage (RSC, apps/web)
  └─ CoherenceBlock (client)
       ├─ useSpaceBySlug → space.id
       ├─ useFindCoherences → signals[]
       └─ SignalSection
            ├─ useSignalsSection (pagination/search)
            ├─ type filter badges (URL param ?type=)
            └─ SignalGridContainer → SignalGrid → SignalCard[]
                 └─ [Link to /coherence/chat/:slug]
```

### 4.3 Signal vs Conversation Distinction

In the reference, `coherence-block.tsx` only renders `SignalSection` (no `ConversationSection` in current implementation). `ConversationSection` + `ConversationCard` exist but are not wired in the main block. This may be intentional (phased release).

### 4.4 Chat Detail Flow

```
ChatPage (implicit, via @aside or nested route)
  └─ ChatDetail (client)
       ├─ useConversation({ chatId: slug }) → conversation data
       ├─ ChatHead (creator + date)
       ├─ ChatRoom
       │    ├─ useMatrix → joinRoom, registerRoomListener
       │    └─ ChatMessageContainer → ChatMessage[]
       └─ ChatMessageInput
            ├─ useMatrix → sendMessage
            └─ updateCoherenceBySlug (archive)
```

### 4.5 CreateSignalForm Flow

```
CreateSignalForm
  ├─ react-hook-form + zod (schemaCreateCoherenceForm)
  ├─ COHERENCE_TYPE_OPTIONS → CoherenceTypeButton grid
  ├─ COHERENCE_PRIORITY_OPTIONS → CoherencePriorityButton row
  ├─ COHERENCE_TAGS → MultiSelect
  ├─ RichTextEditor (description)
  └─ onSubmit:
       1. createCoherence(data)          // DB insert
       2. createRoom(coherence.title)    // Matrix room create
       3. updateCoherenceBySlug({ roomId }) // link room to coherence
```

### 4.6 View / Message Count Tracking

- **Views**: incremented in `ChatDetail.useEffect` when conversation is loaded
- **Messages**: updated in `ChatRoom.useEffect` whenever `messages.length` changes (live Matrix updates)

### 4.7 `epics/src/index.ts` Change

```diff
+ export * from './coherence';
```

---

## 5. Route Layer — `apps/web/src/app/[lang]/dho/[id]/`

### 5.1 New Route Files

```
@tab/coherence/
  constants.ts    → getDhoPathCoherence(lang, id) = `/${lang}/dho/${id}/coherence`
  default.tsx     → re-export of page.tsx
  error.tsx       → ErrorBoundary using t('CoherenceTab.errorCoherenceTab')
  page.tsx        → CoherencePage RSC (reads order searchParam, renders CoherenceBlock)

@aside/coherence/
  default.tsx     → re-export of page.tsx
  page.tsx        → returns null (placeholder for future aside content)
```

### 5.2 DHO workspace nav (replaces former horizontal tabs)

```diff
+ import { getDhoPathCoherence } from '../@tab/coherence/constants';
+ { title: t('Coherence'), name: 'coherence', href: getDhoPathCoherence(lang, id) },
```
> Inserted **before** Agreements in the tab order.

### 5.3 `i18n` — Common namespace

```diff
+ "Coherence": "Coherence"   // in Common namespace (for nav tab label)
```

### 5.4 `layout.tsx` Changes

Minor cleanup:
- `getFormatter` import removed (unused after date format change)
- Date display now uses `formatDate(spaceFromDb.createdAt, true)` from `@hypha-platform/ui-utils`
- Extra blank line before `return`

### 5.5 URL Structure

```
/[lang]/dho/[id]/coherence              → CoherencePage (SignalSection)
/[lang]/dho/[id]/coherence/new-signal   → CreateSignalForm (inferred from hrefs)
/[lang]/dho/[id]/coherence/chat/[slug]  → ChatDetail
```

---

## 6. i18n — `packages/i18n/src/messages/`

### 6.1 New Namespace: `CoherenceTab`

Required keys (en.json):

```json
{
  "signals": "Signals",
  "signInToSee": "Please, sign in to see signals and conversations",
  "searchSignals": "Search signals...",
  "improve": "Improve",
  "newSignal": "New Signal",
  "all": "All",
  "listIsEmpty": "List is empty",
  "mostViews": "Most Views",
  "mostMessages": "Most Messages",
  "mostRecent": "Most Recent",
  "searchConversation": "Search conversation",
  "hideArchived": "Hide archived",
  "highUrgency": "High Urgency",
  "mediumUrgency": "Medium Urgency",
  "lowUrgency": "Low Urgency",
  "mentions": "{count} mentions",
  "unarchiveConversation": "Unarchive Conversation",
  "unarchiveConfirm": "...",
  "yesUnarchive": "Yes, unarchive",
  "noLeave": "No, leave",
  "unarchive": "Unarchive",
  "openConversation": "Open conversation",
  "saySomething": "Say something...",
  "proposeAgreement": "Propose Agreement",
  "errorOhSnap": "...",
  "reset": "Reset",
  "creatingNewSignal": "Creating new signal",
  "signalTitle": "Signal title...",
  "type": "Type",
  "priority": "Priority",
  "tags": "Tags",
  "selectOneOrMore": "Select one or more",
  "description": "Description",
  "descriptionPlaceholder": "...",
  "publish": "Publish",
  "createdOn": "Created on {date}",
  "archiveConversation": "Archive Conversation",
  "archiveConfirm": "...",
  "yesArchive": "Yes, archive",
  "errorCoherenceTab": "...",
  "types": { "Opportunity": "...", "Risk": "...", "Tension": "...", "Insight": "...", "Trend": "...", "Proposal": "..." },
  "typeDescriptions": { ... },
  "priorities": { "high": "...", "medium": "...", "low": "..." },
  "priorityDescriptions": { ... }
}
```

### 6.2 `Common` Namespace Addition

```json
"Coherence": "Coherence"
```

### 6.3 Locale Files Requiring Update

All five locales: `en.json`, `de.json`, `es.json`, `fr.json`, `pt.json`.

---

## 7. Key Dependencies & Cross-Package Relationships

```
apps/web
  → @hypha-platform/epics (CoherenceBlock, CoherenceOrder, COHERENCE_ORDERS)
  → @hypha-platform/i18n (Locale)

packages/epics/src/coherence
  → @hypha-platform/core/client (useFindCoherences, useCoherenceMutationsWeb2Rsc, useJwt, useMatrix, useSpaceBySlug, Coherence, COHERENCE_TYPE_OPTIONS)
  → @hypha-platform/core/server (Coherence type for ChatDetail)
  → @hypha-platform/ui (Card, Button, Input, Skeleton, Badge, Form, etc.)
  → @hypha-platform/ui-utils (formatDate, formatRelativeDateShort, stripMarkdown, stripDescription)
  → @hypha-platform/i18n (Locale)
  → next-intl (useTranslations)

packages/core/src/coherence
  → @hypha-platform/storage-postgres (coherences table, Coherence type)
  → drizzle-orm (query builder)
  → swr / swr/mutation (hooks)
  → zod (validation)

packages/storage-postgres/src/schema
  → drizzle-orm/pg-core
  → ./space (foreign key reference)
  → ./shared (commonDateFields)
```

---

## 8. Pre-existing Infrastructure (Already in `feat/panel-header`)

The following already exist on the current branch and do **not** need to be created:

- `packages/storage-postgres/src/schema/coherence.ts` — **does NOT exist** (needs creation)
- `packages/core/src/coherence/` — partial: `index.ts`, `types.ts` (minimal), `lib/`, `server.ts` (to be replaced)
- `packages/core/src/server.ts` — already exports coherence server + types
- Matrix hooks (`useMatrix`, `useJwt`, etc.) — already in `@hypha-platform/core/client`
- `useSpaceBySlug`, `usePersonById`, `useMe`, `usePersonBySub`, `useUserPrivyIdByMatrixId` — already in core/client
- `ButtonClose`, `Empty`, `PersonLabel`, `PersonAvatar` — already in epics/common and epics/people
- `CardButton` — already in epics/common

---

## 9. Identified Risks & Notes

| Risk | Notes |
|---|---|
| **DB migration required** | `coherences` table must be created. Need to run `drizzle-kit generate` + `migrate`. |
| **Matrix room creation** | `createRoom` must be called after `createCoherence`. Two-phase write can fail silently if Matrix is unavailable. |
| **`use-conversation.ts` relative import** | Uses `../../../../core/src/coherence/server/web3` — a cross-package relative path that will break in production. Should use `@hypha-platform/core/server` import alias instead. |
| **`ConversationSection` not wired** | `CoherenceBlock` only renders `SignalSection`. `ConversationSection` components exist but aren't hooked up. |
| **RLS policies not implemented** | `updateCoherenceBySlugAction` and `deleteCoherenceBySlugAction` have TODO comments re: authToken/RLS (#602). |
| **i18n not complete** | Only `en.json` is shown in diffs; other locales need placeholder translations. |
| **`layout.tsx` breaking change** | Removes `getFormatter` usage for date display — minor visual change (uses `formatDate` util instead). |

---

## 10. Summary of All Files to Create/Modify

### New Files
| Package | File |
|---|---|
| storage-postgres | `src/schema/coherence.ts` |
| storage-postgres | `src/schema/coherence-types.ts` |
| storage-postgres | `src/schema/coherence-priorities.ts` |
| storage-postgres | `src/schema/coherence-statuses.ts` |
| storage-postgres | `src/schema/coherence-tags.ts` |
| core | `src/coherence/coherence-types.ts` |
| core | `src/coherence/coherence-priorities.ts` |
| core | `src/coherence/coherence-tags.ts` |
| core | `src/coherence/validation.ts` |
| core | `src/coherence/client/index.ts` |
| core | `src/coherence/client/hooks/index.ts` |
| core | `src/coherence/client/hooks/useFindCoherences.ts` |
| core | `src/coherence/client/hooks/useCoherenceMutations.web2.rsc.ts` |
| core | `src/coherence/server/index.ts` |
| core | `src/coherence/server/actions.ts` |
| core | `src/coherence/server/mutations.ts` |
| core | `src/coherence/server/queries.ts` |
| core | `src/coherence/server/web3/index.ts` |
| core | `src/coherence/server/web3/get-all-coherences.ts` |
| core | `src/coherence/server/web3/get-coherence-by-slug.ts` |
| epics | `src/coherence/index.ts` |
| epics | `src/coherence/types.ts` |
| epics | `src/coherence/components/index.ts` |
| epics | `src/coherence/components/coherence-block.tsx` |
| epics | `src/coherence/components/signal-section.tsx` |
| epics | `src/coherence/components/signal-grid.tsx` |
| epics | `src/coherence/components/signal-grid.container.tsx` |
| epics | `src/coherence/components/signal-card.tsx` |
| epics | `src/coherence/components/conversation-section.tsx` |
| epics | `src/coherence/components/conversation-grid.tsx` |
| epics | `src/coherence/components/conversation-grid.container.tsx` |
| epics | `src/coherence/components/conversation-card.tsx` |
| epics | `src/coherence/components/chat-detail.tsx` |
| epics | `src/coherence/components/chat-head.tsx` |
| epics | `src/coherence/components/chat-room.tsx` |
| epics | `src/coherence/components/chat-message.tsx` |
| epics | `src/coherence/components/chat-message.container.tsx` |
| epics | `src/coherence/components/chat-message-input.tsx` |
| epics | `src/coherence/components/create-signal-form.tsx` |
| epics | `src/coherence/components/coherence-type-button.tsx` |
| epics | `src/coherence/components/coherence-priority-button.tsx` |
| epics | `src/coherence/hooks/index.ts` |
| epics | `src/coherence/hooks/use-conversation.ts` |
| epics | `src/coherence/hooks/use-conversations-section.ts` |
| epics | `src/coherence/hooks/use-signals-section.ts` |
| web | `src/app/[lang]/dho/[id]/@tab/coherence/constants.ts` |
| web | `src/app/[lang]/dho/[id]/@tab/coherence/page.tsx` |
| web | `src/app/[lang]/dho/[id]/@tab/coherence/default.tsx` |
| web | `src/app/[lang]/dho/[id]/@tab/coherence/error.tsx` |
| web | `src/app/[lang]/dho/[id]/@aside/coherence/page.tsx` |
| web | `src/app/[lang]/dho/[id]/@aside/coherence/default.tsx` |

### Modified Files
| Package | File | Change |
|---|---|---|
| storage-postgres | `src/schema/index.ts` | Import coherences; add to schema object; re-export |
| core | `src/coherence/index.ts` | Expand exports |
| core | `src/coherence/types.ts` | Add domain types (Coherence, CreateCoherenceInput, etc.) |
| core | `src/coherence/server.ts` | **Delete** (replaced by server/ directory) |
| core | `src/client.ts` | Add `export * from './coherence'` |
| epics | `src/index.ts` | Add `export * from './coherence'` |
| web | `DhoSpaceWorkspace` + `getDhoPathCoherence` | Add Coherence item when flag on |
| web | `[id]/layout.tsx` | Remove getFormatter, use formatDate |
| i18n | `src/messages/en.json` | Add CoherenceTab namespace + Common.Coherence key |
| i18n | `src/messages/de.json` | Add CoherenceTab namespace + Common.Coherence key |
| i18n | `src/messages/es.json` | Add CoherenceTab namespace + Common.Coherence key |
| i18n | `src/messages/fr.json` | Add CoherenceTab namespace + Common.Coherence key |
| i18n | `src/messages/pt.json` | Add CoherenceTab namespace + Common.Coherence key |
