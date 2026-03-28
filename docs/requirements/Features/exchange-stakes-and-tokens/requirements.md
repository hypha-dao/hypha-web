# Exchange Stakes & Tokens (proposal + contract integration)

**Traceability**

| Item | Value |
|------|--------|
| GitHub issue | [hypha-web#743](https://github.com/hypha-dao/hypha-web/issues/743) |
| Title (issue) | Exchange Ownership |
| Status | Draft for implementation |
| Smart contract target | `packages/storage-evm/contracts/EscrowImplementation.sol` (`IEscrow`) |
| Related baseline | `en/dho/2026-1/agreements/create/pay-for-expenses` flow parity |

---

## 1. Problem statement

Spaces need a governed way to exchange stakes/tokens/assets between two parties (member or space wallets) while keeping settlement under proposal control.

Current create-flow exposes “Exchange Ownership (Coming Soon)” only, so users cannot create this proposal type despite existing reusable proposal components and contract-call patterns.

---

## 2. Goals and non-goals

**Goals**

- Enable a production-ready “Exchange Stakes & Tokens” create action and proposal template.
- Reuse existing proposal architecture and UI components to keep implementation clean and low-risk.
- Mirror the existing `pay-for-expenses` create/orchestrator contract-invocation pattern while targeting escrow creation via `EscrowImplementation`.
- Support two-sided exchange terms: seller leg and buyer leg, each with wallet + token/amount entries.
- Integrate on-chain settlement through `EscrowImplementation` (`createEscrow`, `receiveFunds`, `getEscrow`) instead of direct bilateral transfer transactions.

**Non-goals**

- Designing or deploying a new swap/escrow smart contract in this scope.
- Introducing a custom multi-step settlement engine outside the existing proposal execution model.
- Redesigning the proposal framework or replacing existing orchestration primitives.

---

## 3. Definitions

- **Seller**: Party providing the first asset leg in the exchange.
- **Buyer**: Party providing the counter asset leg in the exchange.
- **Settlement treasury**: The space executor/treasury wallet from which accepted proposal transfers are executed.
- **Exchange leg**: A list of `{amount, token}` entries associated with one side (seller or buyer).
- **Parity flow**: Existing create/orchestrator/call sequence used by `pay-for-expenses`.

---

## 4. User story

**As a** space member with proposal permissions,  
**I want** to create an “Exchange Stakes & Tokens” proposal with seller/buyer terms,  
**So that** the community can vote and, after approval and funding, execute the token exchange through the existing governance contracts.

---

## 5. Parity constraints (must mirror existing flow)

**PAR-1** The system SHALL use the same structural create-page composition as `pay-for-expenses`: side panel page, base agreement fields, plugin-specific fields, publish action.

**PAR-2** The system SHALL use the same orchestrator lifecycle pattern as `pay-for-expenses`: create Web2 agreement, create Web3 proposal, upload files, link Web2/Web3 IDs, with rollback of Web2 agreement on Web3 failure before link.

**PAR-3** The system SHALL use the same Web3 proposal creation pattern as `pay-for-expenses`: compute min proposal duration, build transaction array, call `daoProposalsImplementation.createProposal`, wait for receipt, derive proposal ID from logs.

**PAR-4** The system SHALL target escrow operations by encoding transactions against `EscrowImplementation` and ERC-20 approval calls needed by escrow funding.

**PAR-5** The system SHALL reuse existing recipient and token amount selector primitives (member/space selector + manual wallet entry + token payout rows) rather than introducing bespoke UI controls.

---

## 6. Functional requirements

### 6.1 Create action and copy

**FR-1** The system SHALL replace the current create-action copy from “Exchange Ownership (Coming Soon)” to:
- Title: `Exchange Stakes & Tokens`
- Description: `Swap ownership stakes, tokens, or other assets between members or spaces.`

**FR-2** The system SHALL expose this action as an enabled create path (`agreements/create/exchange-stakes-and-tokens`) for eligible users, following the same gating behavior as other active agreement actions.

### 6.2 Proposal form and reusable fields

**FR-3** The system SHALL open an exchange proposal template with base fields reused from existing agreement forms:
- Title (short text)
- Image upload
- Description/content
- Attachments

**FR-4** The system SHALL set proposal label/action to `Exchange` internally and SHALL NOT require a visible action selector in the UI.

**FR-5** The system SHALL capture Seller wallet via:
- member/space searchable dropdown selector
- manual wallet address input field

**FR-6** The system SHALL capture Seller “will send” leg as one row in V1 escrow mode:
- amount (numeric input)
- token (treasury-referenced token dropdown)
- optional future extensibility for multiple rows SHALL remain out-of-scope unless mapped to multiple escrows.

**FR-7** The system SHALL capture Buyer wallet via:
- member/space searchable dropdown selector
- manual wallet address input field

**FR-8** The system SHALL capture Buyer “will send” leg as one row in V1 escrow mode:
- amount (numeric input)
- token (native or treasury-referenced token dropdown; if native is unavailable in current stack, the system SHALL document and constrain to supported tokens)
- optional future extensibility for multiple rows SHALL remain out-of-scope unless mapped to multiple escrows.

### 6.3 Validation and data model

**FR-9** The system SHALL validate seller and buyer wallet fields as non-empty valid EVM addresses.

**FR-10** The system SHALL require exactly one valid `{amount, token}` entry on each exchange leg for the initial escrow integration release.

**FR-11** The system SHALL enforce all existing agreement validation constraints for title, description, lead image, and attachments.

**FR-12** The system SHALL persist exchange proposal data in Web2 with explicit fields for seller wallet, buyer wallet, seller leg rows, buyer leg rows, and proposal label.

### 6.4 Contract integration and settlement

**FR-13** The system SHALL create the Web3 proposal using the same proposal endpoint used by `pay-for-expenses` (`createProposal` on DAO proposals implementation), but SHALL encode escrow-setup transactions targeting `EscrowImplementation`.

**FR-14** The system SHALL encode the on-chain transaction sequence for proposal execution as:
- ERC-20 safe allowance update for seller-side token (for example `approve(escrowContract, 0)` followed by `approve(escrowContract, amountA)`, or another documented safe-allowance strategy for supported tokens) from executor/treasury
- `EscrowImplementation.createEscrow(partyB, tokenA, tokenB, amountA, amountB, sendFundsNow)` where:
  - `partyB` = buyer wallet from form
  - `tokenA`/`amountA` = seller leg
  - `tokenB`/`amountB` = buyer leg
  - `sendFundsNow` = `true` for immediate party-A funding in the same execution flow

**FR-15** The system SHALL provide buyer funding instructions after proposal acceptance/execution:
- buyer MUST approve `tokenB` allowance to `EscrowImplementation`
- buyer MUST call `receiveFunds(escrowId)` from buyer wallet
- once both parties are funded, escrow auto-completion SHALL transfer `tokenA` to buyer and `tokenB` to party A per contract logic.

**FR-16** The system SHALL use the same duration behavior as parity flow: space minimum proposal duration when configured, otherwise fallback default duration.

**FR-17** The system SHALL link `web3ProposalId` back to the Web2 agreement record after successful on-chain proposal creation, matching existing agreement/proposal linkage behavior.

**FR-18** The system SHALL fail creation atomically if on-chain proposal creation fails after Web2 draft creation, deleting the newly created Web2 agreement record before surfacing error state (same rollback policy as parity flow).

**FR-19** The system SHALL record and expose escrow lifecycle metadata (`escrowId` when available, funding/completion/cancel status) in proposal detail views or linked activity surfaces.

### 6.5 Funding and execution UX

**FR-20** The system SHALL provide funding actions in proposal context using existing wallet-funding primitives:
- treasury deposit (copy address / QR) for pre-funding seller-side token
- buyer-side guidance for escrow allowance + `receiveFunds` execution.

**FR-21** The system SHALL present exchange proposal details using existing proposal detail components plus exchange-specific rendering for both legs and escrow status, without regressing existing transfer proposal displays.

**FR-22** The system SHALL define whether `cancelEscrow` and `withdrawFromCancelled` are exposed in V1 UI; if not exposed, the system SHALL document this operational constraint in release notes and support docs.

---

## 7. Non-functional requirements

**NFR-1** The implementation SHALL maximize component reuse from existing proposal flows and SHALL avoid introducing duplicate custom field components when equivalent components already exist.

**NFR-2** The create flow SHALL preserve current orchestrator UX semantics: progress steps, keep-window-open messaging, reset-on-error behavior.

**NFR-3** The contract call path SHALL remain network-compatible with current Base chain configuration and existing smart wallet execution path.

**NFR-4** All new user-facing labels/messages SHALL be added to existing i18n message namespaces and SHALL not hardcode visible strings in components.

**NFR-5** The solution SHALL integrate against the deployed `EscrowImplementation` ABI/address configuration used by the app runtime and SHALL avoid hardcoded ad-hoc addresses in component code.

**NFR-6** The solution SHALL not require smart contract source changes for the initial release scope.

---

## 8. Acceptance criteria

**AC-1** Given a member opens global Create action list,  
When the list is rendered,  
Then “Exchange Stakes & Tokens” appears as an enabled action with the new description.

**AC-2** Given the user opens the exchange create route,  
When the form is displayed,  
Then base proposal fields and seller/buyer exchange fields are visible and action is preselected internally as Exchange.

**AC-3** Given either seller or buyer wallet is invalid,  
When the user submits,  
Then the proposal is blocked and inline validation error is shown.

**AC-4** Given one side has no payout rows,  
When the user submits,  
Then submission is blocked with a clear amount/token validation message.

**AC-5** Given valid exchange input and connected smart wallet,  
When the user publishes,  
Then Web2 agreement is created, Web3 proposal is created via `createProposal` containing escrow-setup transactions (`approve` + `createEscrow`), files are uploaded, and `web3ProposalId` is linked in Web2.

**AC-6** Given Web3 proposal creation fails after Web2 agreement creation,  
When orchestration handles the failure,  
Then the created Web2 agreement is deleted and the user sees recoverable error/reset state.

**AC-7** Given an accepted exchange proposal needs funding,  
When a participant opens funding guidance,  
Then treasury wallet funding UX (address copy / QR) and buyer `approve + receiveFunds(escrowId)` instructions are available.

**AC-8** Given an exchange proposal is opened in proposal detail,  
When proposal metadata is rendered,  
Then both seller and buyer legs are displayed clearly with wallet + token + amount context and escrow lifecycle status (pending funded/completed/cancelled when available).

---

## 9. Reuse map (clean implementation baseline)

- Leverage the create page + side panel wiring pattern from `pay-for-expenses`.
- Adopt `CreateAgreementBaseFields`.
- Extend recipient selector + manual address component patterns for both seller and buyer.
- Apply token payout row and field-array patterns for both exchange legs.
- Integrate the orchestrator task state machine pattern (`CREATE_WEB2`, `CREATE_WEB3`, `UPLOAD_FILES`, `LINK`).
- Extend proposal details decoding/rendering infrastructure only where necessary for exchange-specific labeling + escrow status.
- Apply wallet funding modal/QR integration for treasury deposit flow.
- Wire escrow ABI/address through generated/runtime client contract configs.

---

## 10. Open questions / decisions required

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| OQ-1 | For “native token” support in buyer leg, do we support true native asset transfer in V1 or constrain to ERC-20 tokens only (contract currently ERC-20 only)? | Product + Engineering | Open |
| OQ-2 | Should seller funding also expose explicit QR/copy flow, or only buyer per current issue text? | Product | Open |
| OQ-3 | Should exchange details be represented in dedicated structured fields on the document model, markdown payload, or both? | Engineering | Open |
| OQ-4 | Is partial settlement (one leg funded, one unfunded) allowed to remain pending indefinitely, or should timeout/cancel UX be mandatory in V1? | Product + Engineering | Open |
| OQ-5 | Which deployed `EscrowImplementation` proxy address per environment (dev/staging/prod) is canonical for app integration? | DevOps + Engineering | Open |
| OQ-6 | In V1, is party A always treasury/executor (proposal-created escrow), or must UI support direct seller-created escrows where party A is non-treasury wallet? | Product + Engineering | Open |

---

## 11. Implementation ticket decomposition (for execution)

- **T-1 Action & routing:** enable create action, route, and i18n copy updates.
- **T-2 Form schema:** add exchange schema + validation (seller, buyer, dual payout arrays).
- **T-3 Plugin UI:** implement exchange plugin using reusable recipient/payout components for both sides (single pair per side in V1).
- **T-4 Orchestrator + Web3 mutation:** implement parity lifecycle + transaction mapping to escrow (`approve` + `createEscrow` via proposal).
- **T-5 Proposal detail rendering:** add exchange-specific proposal display/parsing + escrow status where needed.
- **T-6 Funding UX linkage:** expose treasury deposit (QR/copy) action and buyer `approve + receiveFunds` flow guidance.
- **T-7 QA coverage:** add/create-path and orchestration tests (success + rollback path).

---

## 13. Security notes for allowance handling

- Implementations integrating `FR-14` SHALL use a token-safe approval pattern for
  ERC-20 compatibility (especially for tokens that reject non-zero to non-zero
  allowance updates).
- The implementation MUST choose and document one of:
  - `approve(0)` then `approve(amount)`,
  - `SafeERC20.forceApprove(...)`,
  - allowance delta updates (`safeIncreaseAllowance` /
    `safeDecreaseAllowance`), or
  - `permit()` (ERC-2612), when supported by the token.
- The chosen approval strategy SHALL be consistent per supported token set and
  SHALL be part of release validation criteria.

---

## 12. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.2 | 2026-03-28 | Requirements (agent) | Updated smart-contract integration target to `EscrowImplementation.sol`; revised FR/NFR/AC, reuse map, and open questions for escrow lifecycle. |
| 0.1 | 2026-03-28 | Requirements (agent) | Initial draft spec for issue #743 with pay-for-expenses parity and contract integration definition. |
