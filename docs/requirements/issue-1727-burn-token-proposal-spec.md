# Issue #1727 Specification — Burn Token Proposal

## 1) Context

GitHub issue: `hypha-dao/hypha-web#1727`  
Feature intent: add a **Token Burning** proposal flow that mirrors existing **Treasury Minting** proposal architecture and executes on-chain burn actions after proposal approval.

## 2) Current-State Discovery (Mint Parity Baseline)

### Mint flow currently implemented

1. **Settings action/menu entry**
   - `apps/web/src/app/[lang]/dho/[id]/_components/select-settings-action.tsx`
   - Action title/description from `SpaceSettingsAction.actions.mintTokensToSpaceTreasury`
   - Route: `create/mint-tokens-to-space-treasury`

2. **Create page + form**
   - `apps/web/src/app/[lang]/dho/[id]/@aside/[tab]/create/mint-tokens-to-space-treasury/page.tsx`
   - Form: `packages/epics/src/governance/components/mint-tokens-to-space-treasury-form.tsx`
   - Plugin UI: `packages/epics/src/treasury/plugins/mint-tokens-to-space-treasury/plugin.tsx`
   - Validation: `schemaMintTokensToSpaceTreasury` in `packages/core/src/governance/validation.ts`

3. **Web2 + Web3 orchestration**
   - Orchestrator: `useMintTokensToSpaceTreasuryOrchestrator.ts`
   - Web3 mutation: `useMintTokensToSpaceTreasuryMutations.web3.rsc.ts`
   - On-chain tx creation:
     - `daoProposalsImplementation.createProposal(...)`
     - transaction target = selected token address
     - calldata = `decayingSpaceTokenAbi.mint(to, amount)`

4. **Proposal details decoding + rendering**
   - Decode: `packages/core/src/governance/client/hooks/decoders.ts` (`type: 'mint'`)
   - Aggregate: `useProposalDetails.web3.rpc.ts` (`mintings[]`)
   - Render: `proposal-detail.tsx` + `proposal-mint-item.tsx`

5. **Resubmit route mapping**
   - `packages/epics/src/proposals/components/form-voting.tsx`
   - Label mapping: `'Treasury Minting' -> 'mint-tokens-to-space-treasury'`

## 3) Burn Contract Discovery and Connection Strategy

### Contracts with burn capability found

1. **Space tokens (the same token family used in mint proposal target dropdown)**
   - `RegularSpaceToken` inherits `ERC20BurnableUpgradeable`
   - ABI (generated) includes `burn(uint256)` and `burnFrom(address,uint256)`
   - `DecayingSpaceToken` and `OwnershipSpaceToken` inherit from `RegularSpaceToken`

2. **HyphaToken**
   - `HyphaToken.burnFrom(address,uint256)` exists
   - Restricted by `onlyOwner` (not parity-friendly for arbitrary space-token burn proposals)

### Connection approach (mint-parity compatible)

**Primary connection path SHALL match mint proposal architecture:**

- create a DAO proposal with one or more transactions via `daoProposalsImplementation.createProposal`
- each transaction target is the selected token contract
- each transaction calldata encodes burn function invocation

### Critical permission constraint

For space tokens, `burnFrom(from, amount)` from proposal executor requires allowance from `from` to executor (standard ERC20Burnable behavior).  
This is a blocker for frictionless burn from arbitrary member/wallet addresses unless one of these is chosen:

1. **Option A (recommended for product intent):** Add executor-authorized burn method in token contracts (e.g. `burnByExecutor(from, amount)` restricted to token `executor`) and use that in proposal tx calldata.
2. **Option B (no contract change):** Use `burnFrom` and require prior allowance approvals by each target address; proposal creation must validate/pre-warn.

## 4) Scope

### In scope

- New settings action under treasury group, positioned below mint action.
- New create proposal route and UI for token burning.
- Burn proposal validation schema.
- Burn proposal Web2/Web3 orchestration parity with mint.
- Proposal tx encoding for burn.
- Proposal detail decoder + render for burn entries.
- Resubmit route mapping for label `Token Burning`.
- i18n strings for menu/form/errors/details.
- QA automation additions (unit/integration/E2E where feasible).

### Out of scope

- Non-Base chain support.
- Bulk gas optimization contract redesign beyond burn capability needed for this feature.
- Retroactive migration of previous proposals.

## 5) Functional Requirements

**FR-1** The system SHALL display a new treasury settings action titled **“Burn Tokens on Specified Spaces or Wallets”** directly below the mint action entry.

**FR-2** The system SHALL route the new action to a dedicated create page at `create/token-burning` (final slug to be confirmed) and load a burn proposal form patterned on the mint proposal form.

**FR-3** The system SHALL create a burn proposal with proposal label **“Token Burning”** while preserving shared base fields parity with mint proposal: title, image, description, attachments.

**FR-4** The system SHALL provide a **Select Token** section with description **“Choose a token to burn”** and a dropdown constrained to tokens created in the current space.

**FR-5** The system SHALL show “No token found.” in the token selector and display: **“Your space has not yet created a token, click here to first issue a token”** linking to issue-token proposal creation when no eligible token exists.

**FR-6** The system SHALL provide a **Token Burn** section with repeatable burn rows containing:

- target type (member/space),
- target selector,
- resolved wallet address,
- amount field,
- “All balance” checkbox,
- add/remove row controls.

**FR-7** The system SHALL auto-populate the burn address field when a member or space is selected and SHALL allow manual address entry when no selector value is used.

**FR-8** The system SHALL support multiple burn rows in one proposal by creating one on-chain transaction per row in the proposal transaction list.

**FR-9** The system SHALL submit burn proposals through the same orchestration pattern as mint proposals (Web2 agreement + Web3 proposal + linkage by `web3ProposalId`).

**FR-10** The system SHALL encode burn transactions into `createProposal` so that approved voting execution triggers token burn calls on-chain.

**FR-11** The system SHALL decode and display burn actions in proposal details similarly to mint action visibility.

**FR-12** The system SHALL map proposal label **“Token Burning”** to its create route in resubmit flow.

## 6) Parity Constraints

**PAR-1** The burn proposal submission lifecycle SHALL reuse mint proposal orchestration semantics (task state, progress UX, rollback behavior on failure).  
**PAR-2** The burn proposal page/frame SHALL preserve mint page navigation semantics (success URL, back URL, close URL).  
**PAR-3** The burn proposal SHALL use DAO proposal transaction batching semantics identical to mint (array of transactions executed by proposal executor).  
**PAR-4** Shared agreement fields and attachment behavior SHALL remain unchanged from mint proposal UX.

## 7) Non-Functional Requirements

**NFR-1** The burn proposal form SHALL validate synchronously on change and block submit on invalid addresses, zero/negative amounts, missing token, or empty burn-row list.  
**NFR-2** Proposal creation latency for burn path SHALL not exceed mint-path p95 by more than 10% under equivalent network conditions.  
**NFR-3** All user-facing burn strings SHALL be internationalized and localized via `packages/i18n/src/messages/en.json` structure parity.  
**NFR-4** Decoder handling SHALL be backward-safe: unknown tx types MUST NOT break proposal details rendering.

## 8) Acceptance Criteria

**AC-1** Given a user opens Space Settings treasury actions,  
When actions are listed,  
Then a burn action appears directly below mint with specified title and description.

**AC-2** Given a user opens burn proposal page,  
When base proposal form renders,  
Then title/image/description/attachments fields match mint proposal behavior.

**AC-3** Given no space tokens exist,  
When user opens token selector,  
Then “No token found.” appears and the issue-token helper message/link is visible and navigable.

**AC-4** Given at least one token exists,  
When user selects a token and adds burn rows,  
Then member/space selection resolves an address and row validation enforces valid amount and address.

**AC-5** Given a row has “All balance” checked,  
When the row is displayed,  
Then a warning message appears explaining full-balance irreversible burn semantics.

**AC-6** Given user submits a valid burn proposal,  
When orchestration succeeds,  
Then Web2 document is created, Web3 proposal is created, and `web3ProposalId` is linked.

**AC-7** Given a burn proposal contains N burn rows,  
When web3 proposal tx payload is built,  
Then proposal includes N burn transactions targeting selected token contract(s).

**AC-8** Given a burn proposal is viewed in proposal details,  
When transaction data is decoded,  
Then burn rows are rendered in a dedicated burn presentation component.

**AC-9** Given a burn proposal is withdrawn and resubmitted,  
When resubmit is triggered from voting form,  
Then route resolves to burn create page using `Token Burning` label mapping.

## 9) Data and Validation Rules

- Burn row min cardinality: 1.
- Amount rule:
  - If “All balance” unchecked: amount required and `> 0`.
  - If checked: amount input disabled or ignored; effective amount derived per selected semantics.
- Address rule: must be EVM address (`0x` + 40 hex chars).
- Token rule: must be one of current space-issued tokens.
- Duplicate rows:
  - Allowed initially unless product decides to deduplicate by `(token, address)` (open question).

## 10) Contract/Execution Decision Gate (Must be resolved)

### Decision D-1: Burn authority model

To support “burn from chosen spaces or wallet addresses” without off-band approvals:

- **Preferred:** implement executor-authorized burn method on space token contracts and use that for proposal tx encoding.

If D-1 is not approved:

- implement allowance-based burnFrom flow and explicitly require allowances from target addresses; UX must communicate potential execution revert risk.

### Decision D-2: “All balance” semantics

Choose one:

1. **Snapshot at proposal creation** (amount fixed then; execution may fail if balance falls).
2. **Evaluate at execution** (requires callable contract function that computes current balance during execution).

## 11) Implementation Map (Expected files to touch)

- Menu/action:
  - `apps/web/src/app/[lang]/dho/[id]/_components/select-settings-action.tsx`
  - `packages/i18n/src/messages/en.json` (`SpaceSettingsAction.actions.*`)

- Routing/page:
  - `apps/web/src/app/[lang]/dho/[id]/@aside/[tab]/create/token-burning/page.tsx` (new)
  - `apps/web/src/app/[lang]/dho/[id]/_components/plugins.tsx`

- Form/plugin:
  - `packages/epics/src/governance/components/create-proposal-token-burning-form.tsx` (new)
  - `packages/epics/src/treasury/plugins/token-burning/plugin.tsx` (new)
  - exports in:
    - `packages/epics/src/treasury/plugins/index.ts`
    - `packages/epics/src/governance/components/index.ts`

- Validation + hooks:
  - `packages/core/src/governance/validation.ts` (new schema)
  - `packages/core/src/governance/client/hooks/useTokenBurningOrchestrator.ts` (new)
  - `packages/core/src/governance/client/hooks/useTokenBurningMutations.web3.rsc.ts` (new)

- Decode/details:
  - `packages/core/src/governance/client/hooks/decoders.ts` (burn decode case)
  - `packages/core/src/governance/client/hooks/useProposalDetails.web3.rpc.ts` (aggregate burns)
  - `packages/epics/src/governance/components/proposal-burn-item.tsx` (new)
  - `packages/epics/src/proposals/components/proposal-detail.tsx`

- Resubmit mapping:
  - `packages/epics/src/proposals/components/form-voting.tsx`

- Contract changes (if D-1 Option A approved):
  - `packages/storage-evm/contracts/RegularSpaceToken.sol`
  - inherited behavior in `DecayingSpaceToken.sol`, `OwnershipSpaceToken.sol`
  - generated ABIs (`packages/core/src/generated.ts`) via existing generation process

## 12) QA/Test Specification

### 12.1 Unit tests

1. **Validation schema tests**
   - valid/invalid addresses
   - amount rules with/without all-balance
   - no-token/no-row errors

2. **Web3 mutation builder tests**
   - creates one tx per burn row
   - encodes expected function selector and args
   - applies correct decimals conversion

3. **Decoder tests**
   - decodes burn tx to `type: 'burn'`
   - non-burn tx unaffected

### 12.2 Integration tests

1. **Orchestrator tests**
   - successful Web2+Web3+link flow
   - rollback/delete behavior on Web3 failure

2. **Proposal detail rendering**
   - burn entries render with address/entity + token + amount

### 12.3 E2E tests (Playwright)

1. Create burn proposal happy path with one row.
2. Add multiple burn rows and submit.
3. No-token state shows helper link.
4. All-balance checkbox message visibility.
5. Resubmit from proposal detail routes back to burn create page.

### 12.4 Contract-level tests (if D-1 Option A)

1. Executor can burn from target without allowance.
2. Non-executor cannot call executor-burn.
3. Total supply decreases by burned amount.
4. Proposal execution succeeds with burn tx and updates proposal executed state.

## 13) Risks

1. **Execution reverts** if burn authority model is unresolved and allowance assumptions fail.
2. **All-balance race conditions** if balance changes between proposal creation and execution.
3. **Decoder gaps** if burn calldata variant differs across token ABIs.

## 14) Open Questions

1. Should initial release support burning only from current space treasury, or from arbitrary addresses as issue text suggests?
2. Which burn authority model is approved (D-1 Option A vs Option B)?
3. For “All balance”, should amount be snapshot-at-create or evaluated at execution?
4. Final route slug and label naming confirmation: `token-burning` + `Token Burning`.

## 15) Definition of Ready

- D-1 and D-2 decisions resolved.
- UX copy approved.
- Final route slug confirmed.
- Contract change scope confirmed (yes/no).

## 16) Definition of Done

- All FRs and ACs implemented.
- Unit/integration/E2E tests added and passing.
- Proposal detail supports burn rendering.
- i18n keys merged.
- If contract changes included: solidity tests cover permission and execution behavior.

## 17) Task Update (Issue #1727 Checklist)

Use this section as the task/spec status block for the issue.

### 17.1 UI/UX scope from issue prompts

- [ ] Add a treasury menu entry under minting:
  - **Title:** Burn Tokens on Specified Spaces or Wallets
  - **Description:** Remove (burn) tokens from chosen spaces or wallet addresses. This action reduces the total token supply and can be used to manage circulation or correct allocations.
  - **Position:** directly below minting action in Space Settings.

- [ ] Create proposal type from mint template:
  - **Proposal label:** Token Burning
  - Keep base fields parity with mint proposal:
    - title
    - image upload
    - description
    - attachments

- [ ] Add first section:
  - **Section:** Select Token
  - **Description:** Choose a token to burn
  - **Field:** token dropdown scoped to tokens created in current space.

- [ ] Empty-token UX:
  - show `No token found.`
  - show helper message with hyperlink:
    - `Your space has not yet created a token, click here to first issue a token`
    - link target: issue token proposal route.

- [ ] Add token-burn rows section:
  - **Section:** Token Burn
  - **Description:** Remove (burn) tokens from chosen spaces or wallet addresses. This action reduces the total token supply and can be used to manage circulation or correct allocations.
  - **Row fields:** Select Member, Space toggle, Address (auto-filled if selected), Amount, All balance, Add row.
  - **All balance helper:** When selected, show warning that full balance is permanently burned.

### 17.2 Smart-contract connection scope

- [ ] Connect burn action so approved proposal execution calls token burn on-chain via DAO proposal transactions.
- [ ] Apply mint-flow parity architecture:
  - settings action -> create page -> form/plugin -> orchestrator -> web3 mutation -> `createProposal` tx list -> decoder/detail rendering.
- [ ] Resolve burn authority decision before implementation (Section 10, D-1):
  - Option A (recommended): executor-authorized burn method in space token contracts.
  - Option B: allowance-based `burnFrom` with explicit UX warnings and prechecks.

### 17.3 QA exit checklist

- [ ] Validation tests for token selection, rows, addresses, amounts, and all-balance behavior.
- [ ] Web3 transaction encoding tests (one burn tx per row).
- [ ] Decoder/detail rendering tests for burn proposal data.
- [ ] E2E flow for create + submit + detail + resubmit route mapping.
- [ ] Contract tests for burn authority model chosen in D-1.

---

Note: heading spacing in this document is intentionally kept markdownlint-compliant
(including blank lines around headings in Section 4).
