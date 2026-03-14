# AI Left Panel and Space Context Requirements

> Note: Start from the MVP parity baseline defined in  
> `docs/requirements/chat-signals-ai-prototype-parity-spec.md`.  
> This document extends that baseline with next-level context and intelligence requirements.

## 1. Document Control

- **Owner:** Product + Engineering
- **Status:** Draft (requirements baseline)
- **Date:** 2026-03-14
- **Source conversation:** "AI chat panel with space-aware business consultant assistant"
- **Prototype analyzed:** `origin/feat/rebased/presentation-coherence-screen-and-ai-panel`

## 2. Background and Intent

Hypha needs a left-side AI panel that acts as a business consultant for DAO operators. The assistant must understand the user's current space context and guide setup decisions for spaces, treasuries, and members.

The chat must support:

1. Suggested/default prompts (button-driven starters)
2. Free-form user prompts
3. Multimodal inputs (images, text docs, and other files)

The assistant should generate useful new signals from:

- proposals recorded in the current space
- documents attached to proposals
- conversations held in that space

## 3. Current State (Prototype Findings)

The prototype branch already implements core UI and basic chat plumbing:

- Global left AI panel layout with desktop resize and mobile drawer behavior
  - `apps/web/src/app/layout.tsx`
  - `packages/epics/src/common/ai-left-panel-layout.tsx`
- Chat UI with suggestions, message list, model selector, auth gate, and streaming behavior
  - `packages/epics/src/common/ai-left-panel.tsx`
  - `packages/epics/src/common/ai-panel/*`
- Vercel AI SDK integration with Google model endpoint
  - `apps/web/src/app/api/chat/route.ts`
- Coherence/signal domain and matrix conversation integration already exist
  - `packages/storage-postgres/src/schema/coherence.ts`
  - `packages/epics/src/coherence/components/chat-room.tsx`

Observed gaps versus desired behavior:

- Space/path context is not injected into AI requests.
- Chat API uses a static system prompt and does not retrieve space proposals, attachments, or conversations.
- Multimodal buttons are present but attachment actions are disabled in chat bar UI.
- File-to-chat conversion uses local `data:` URLs (`convert-files-to-parts.ts`) rather than persisted Upload plugin references.
- No implemented pipeline to synthesize "new signals" from proposals + documents + conversations.

## 4. Product Goals and Non-Goals

### 4.1 Goals

1. Deliver a context-aware AI copilot that is useful for governance and operations in each space.
2. Make the assistant opinionated in a constructive "business consultant" way.
3. Enable multimodal context ingestion via existing Upload plugin.
4. Enable AI-assisted signal generation grounded in verifiable space data.

### 4.2 Non-goals (initial release)

1. Fully autonomous execution of governance actions on behalf of users.
2. Unbounded web research as primary evidence source (space data is primary).
3. Replacing existing proposal/conversation UIs.

## 5. Personas and Primary Jobs-To-Be-Done

1. **Space Admin / Steward**
   - Needs recommendations for structure, treasury setup, and membership policy.
2. **Contributor / Coordinator**
   - Needs quick synthesis of proposals/conversations and drafting support.
3. **New Member**
   - Needs onboarding guidance aligned with current space configuration.

## 6. Assistant Bias and Behavioral Requirements

The assistant must have an explicit consultative bias:

- Diagnose user intent first (objective, constraints, timeline).
- Recommend configuration changes in platform terms (space settings, treasury setup, member roles, proposal path).
- Explain trade-offs and risks clearly.
- Default to actionable next steps in Hypha workflows.

### 6.1 Tone and policy constraints

- Professional, concise, practical.
- Never fabricate platform state; when uncertain, ask clarifying questions.
- Distinguish facts from recommendations.

## 7. Functional Requirements

### 7.1 Panel and Session Context

- **FR-1:** The AI panel SHALL be available as a left panel in DHO views and retain current responsive behavior (desktop resizable, mobile drawer).
- **FR-2:** Every chat request SHALL include current navigation context at minimum:
  - `lang`
  - `spaceSlug`
  - active section/tab
  - optional target entity (proposal slug, chat room slug, member slug)
- **FR-3:** The backend SHALL resolve `spaceSlug` to internal `spaceId` and use it as the primary retrieval scope.

### 7.2 Prompt Modes

- **FR-4:** UI SHALL support default prompt suggestions and free-form prompts in the same conversation.
- **FR-5:** Suggestion prompts SHALL be configurable per context (e.g., coherence vs treasury vs members).
- **FR-6:** User may reset conversation without losing panel state (open/size).

### 7.3 Multimodal Inputs

- **FR-7:** Users SHALL be able to attach files (images, PDF, text) from chat input.
- **FR-8:** Attached files SHALL be persisted using the existing Upload plugin storage pattern (same approach as proposal attachments), not only embedded as temporary `data:` payloads.
- **FR-9:** Uploaded files SHALL be represented as retrievable context artifacts with metadata:
  - file id/url
  - media type
  - filename
  - uploader
  - linked space and optional linked proposal
- **FR-10:** The model context builder SHALL include selected/attached artifacts for the current turn.

### 7.4 Space Knowledge and Retrieval

- **FR-11:** The assistant context builder SHALL retrieve proposals for the current space (title, status, summary, timestamps, authors).
- **FR-12:** The assistant context builder SHALL retrieve proposal attachments metadata and textual extracts when available.
- **FR-13:** The assistant context builder SHALL retrieve conversation summaries/signals from space-related chat rooms.
- **FR-14:** Retrieval SHALL apply relevance ranking against current user query and context.
- **FR-15:** Assistant responses SHALL include grounded references (at least source category and item identifiers) when claims are derived from space data.

### 7.5 AI-Generated Signal Support

- **FR-16:** Assistant SHALL be able to propose candidate new signals based on:
  - proposal trends
  - attachment content
  - conversation patterns
- **FR-17:** Signal suggestions SHALL include structured fields compatible with coherence creation:
  - title
  - description
  - type
  - priority
  - optional tags
- **FR-18:** User SHALL confirm before creating any new signal in the platform.

### 7.6 Business Consultant Guidance

- **FR-19:** For user intents around setup/configuration, assistant SHALL provide recommendations across:
  - space configuration
  - treasury strategy/options
  - member governance/process
- **FR-20:** Recommendations SHALL include "why this helps" and "next action in app" guidance.

### 7.7 Security and Authorization

- **FR-21:** Chat API SHALL validate authenticated user token server-side.
- **FR-22:** Retrieved space data SHALL respect user authorization and space visibility rules.
- **FR-23:** Attachment access SHALL enforce authorization and avoid exposing private file URLs without permission.

## 8. Non-Functional Requirements

- **NFR-1 (Latency):** Time-to-first-token target <= 3s p95 for standard text-only queries.
- **NFR-2 (Reliability):** Chat request success rate >= 99% (excluding client disconnects).
- **NFR-3 (Explainability):** Responses with space-derived claims must include traceable source references.
- **NFR-4 (Safety):** Prompt and output handling must prevent leakage of restricted data across spaces.
- **NFR-5 (Observability):** Log request context scope, retrieval stats, model used, and response outcome (without storing sensitive raw content by default).

## 9. Data and Integration Requirements

### 9.1 Required integrations

1. Vercel AI SDK chat endpoint (`/api/chat`) with context-aware request schema
2. Existing core APIs/queries for spaces, proposals, and coherence
3. Upload plugin storage pipeline for attachments
4. Matrix/conversation layer for chat context summaries

### 9.2 Suggested request contract extension

Chat request body should include:

- `messages`
- `modelId`
- `context`:
  - `spaceSlug`
  - `spaceId` (resolved server-side or provided if trusted)
  - `pathname`
  - `activeTab`
  - `entityRefs` (proposal/chat/member ids)
  - `attachmentRefs` (upload ids/urls + metadata)

## 10. Acceptance Criteria

- **AC-1:** From a space route, assistant correctly identifies current space and references only that space's data.
- **AC-2:** User can send text + file attachment in one turn; backend can consume persisted artifact references.
- **AC-3:** Query "What should we prioritize next?" returns a ranked recommendation grounded in current space proposals/conversations.
- **AC-4:** Query "Draft a signal from recent discussions" returns a prefilled signal draft (title, description, type, priority, tags) and user can confirm creation.
- **AC-5:** Unauthenticated users are prompted to sign in and cannot access chat generation.
- **AC-6:** Unauthorized users cannot retrieve private space documents via AI.

## 11. Metrics of Success

1. Weekly active users of AI panel in DHO routes.
2. Suggestion-to-send conversion rate.
3. % of responses containing grounded references.
4. User-rated helpfulness for setup/configuration guidance.
5. # of accepted AI-assisted signal drafts.

## 12. Delivery Phases

### Phase 1: Context-aware text assistant

- Pass route and space context to backend.
- Add scoped retrieval of proposals and coherence summaries.
- Enforce token validation and auth checks.

### Phase 2: Multimodal with Upload plugin

- Enable file attach actions in chat bar.
- Persist uploads and inject references into context builder.
- Add text extraction for supported formats.

### Phase 3: Signal synthesis workflows

- Add structured signal draft generation.
- Add user confirmation flow to create signal records.
- Add source reference panel for explainability.

## 13. Risks and Open Questions

1. **Source quality:** How to rank proposals vs conversation evidence for recommendations?
2. **Document parsing:** Which formats are in-scope for first extraction pipeline (PDF, markdown, plain text, images with OCR)?
3. **Data retention:** What message and attachment retention policy applies to AI sessions?
4. **Cross-space behavior:** Should user explicitly switch context, or can assistant reason over multiple spaces only when requested?
5. **Model policy:** Is single model sufficient, or do we need tiered model options per task type?

## 14. Traceability to Prototype Components

- Left panel shell + responsive behavior:
  - `packages/epics/src/common/ai-left-panel-layout.tsx`
- AI panel UI and prompt/suggestion controls:
  - `packages/epics/src/common/ai-left-panel.tsx`
  - `packages/epics/src/common/ai-panel/ai-panel-suggestions.tsx`
  - `packages/epics/src/common/ai-panel/ai-panel-chat-bar.tsx`
- Chat API:
  - `apps/web/src/app/api/chat/route.ts`
- Coherence and conversation domain:
  - `packages/storage-postgres/src/schema/coherence.ts`
  - `packages/epics/src/coherence/components/chat-room.tsx`
- App-level panel integration:
  - `apps/web/src/app/layout.tsx`
