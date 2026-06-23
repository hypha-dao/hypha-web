---
name: proposal-discovery
description: Maintain AI proposal discovery and form preparation when adding or updating Agreements create routes. Use when adding a new proposal type, changing create form fields, or updating select-create-action / select-settings-action menus.
---

# Proposal Discovery & MCP Catalog

All on-chain governance proposals (Create proposal + Space settings) must be registered in the **canonical proposal catalog** so `proposal_guidance` and `prepare_governance_proposal` stay in sync with the UI.

**Excluded:** Space configuration (`space-configuration`) — database-only, no blockchain.

## Single source of truth

```
packages/chat-server/src/tools/proposal-catalog/entries.ts
```

Each entry defines:

| Field | Purpose |
|---|---|
| `key` | Stable snake_case tool id (`change_voting_method`, `contribution`, …) |
| `documentLabel` | Must match governance document `label` in DB |
| `templateSegment` | URL segment after `/agreements/create/` |
| `createPath` | Full path suffix (`agreements/create/...`) |
| `prepareStrategy` | `prepare_governance_proposal` or `create_space_setup_proposal` |
| `requiredFields` / `optionalFields` | Discovery questions for the AI |
| `formSection` | Scroll target for AI walkthrough (`data-proposal-section`) |

Derived automatically:

- `packages/chat-server/src/tools/ai-proposal-types.ts` — prompt catalog lines
- `packages/chat-server/src/tools/proposal-guidance.ts` — playbooks
- `packages/chat-server/src/tools/prepare-governance-proposal.ts` — form pre-fill
- `packages/mcp-server` — stdio MCP tools

## Checklist when adding/updating a proposal

1. **UI route** — Add or update href in:
   - `apps/web/.../select-create-action.tsx` (Create proposal menu), and/or
   - `apps/web/.../select-settings-action.tsx` (Space settings)

2. **Catalog entry** — Add/update in `proposal-catalog/entries.ts`:
   - Match `documentLabel` to the UI title / document label
   - Set `templateSegment` to match the URL segment
   - Set `prepareStrategy: 'prepare_governance_proposal'` for typed on-chain forms
   - List `requiredFields` (beyond title/description) and `optionalFields` with `formSection`

3. **Resubmit mapping** — If the form uses nested session keys, extend `buildResubmitPayload` in `proposal-catalog/index.ts` to map `proposal_fields` → resubmit payload keys consumed by `use-resubmit-proposal-data.ts`.

4. **Form sections (walkthrough)** — Mark major sections in the create form:
   ```tsx
   <div data-proposal-section="basics">...</div>
   <div data-proposal-section="payouts">...</div>
   ```
   Call `useProposalFormSectionFocus()` in the form component.

5. **Label → route map** — Add `documentLabel` to `getCreateRouteSegmentForProposalLabel` in `packages/epics/src/utils/resubmit-proposal-template.ts` if missing.

6. **Verify** — Type-check:
   ```bash
   pnpm --filter @hypha-platform/chat-server check-types
   pnpm --filter @hypha-platform/mcp-server check-types
   ```

## AI flow (standard)

```
proposal_guidance(proposal_type)
  → ask required fields (pass collected_fields as you go)
  → offer optional fields one at a time
  → prepare_governance_proposal({ space_slug, proposal_type, title, description, proposal_fields })
  → client writes sessionStorage + navigates to form
  → member clicks Publish (no in-chat wallet signing)
```

**Collective Agreement only:** `create_space_setup_proposal` with `proposal_type: collective_agreement`.

## Tool locations

| Runtime | File |
|---|---|
| Chat AI panel | `packages/chat-server/src/tools/prepare-governance-proposal.ts` |
| Standalone MCP | `packages/mcp-server/src/main.ts` |
| Client navigation | `packages/epics/src/common/ai-left-panel.tsx` |
| Resubmit hydration | `packages/epics/src/hooks/use-resubmit-proposal-data.ts` |

## Common mistakes

- Using `collective_agreement` for voting/entry/transparency — blocked; use typed prepare flow
- Mismatched `documentLabel` vs DB label — resubmit won't hydrate the right form
- Forgetting MCP catalog update — external agents lose discovery for new types
- Space configuration in catalog — keep out; use `update_space_settings` instead
