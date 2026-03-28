# Exchange Stakes & Tokens (proposal + contract integration)

**Traceability**

| Item | Value |
|------|--------|
| GitHub issue | [hypha-web#743](https://github.com/hypha-dao/hypha-web/issues/743) |
| Title (issue) | Exchange Ownership |
| Status | Draft for implementation |
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
- Mirror the existing `pay-for-expenses` contract invocation pattern (`createProposal` with ERC-20 transfer transactions).
- Support two-sided exchange terms: seller leg and buyer leg, each with wallet + token/amount entries.

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

**PAR-4** The system SHALL reuse existing recipient and token amount selector primitives (member/space selector + manual wallet entry + token payout rows) rather than introducing bespoke UI controls.

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

**FR-6** The system SHALL capture Seller “will send” leg as one-or-more rows of:
- amount (numeric input)
- token (treasury-referenced token dropdown)
- add/remove row controls

**FR-7** The system SHALL capture Buyer wallet via:
- member/space searchable dropdown selector
- manual wallet address input field

**FR-8** The system SHALL capture Buyer “will send” leg as one-or-more rows of:
- amount (numeric input)
- token (native or treasury-referenced token dropdown; if native is unavailable in current stack, the system SHALL document and constrain to supported tokens)
- add/remove row controls

### 6.3 Validation and data model

**FR-9** The system SHALL validate seller and buyer wallet fields as non-empty valid EVM addresses.

**FR-10** The system SHALL require at least one valid `{amount, token}` row on each exchange leg.

**FR-11** The system SHALL enforce all existing agreement validation constraints for title, description, lead image, and attachments.

**FR-12** The system SHALL persist exchange proposal data in Web2 with explicit fields for seller wallet, buyer wallet, seller leg rows, buyer leg rows, and proposal label.

### 6.4 Contract integration and settlement

**FR-13** The system SHALL create the Web3 proposal using the same contract endpoint used by `pay-for-expenses` (`createProposal` on DAO proposals implementation) and SHALL encode ERC-20 transfer transactions with `transfer(recipient, amount)`.

**FR-14** The system SHALL build Web3 transactions as bilateral settlement transfers from treasury:
- each seller-leg row becomes transfer of seller token amount to buyer wallet
- each buyer-leg row becomes transfer of buyer token amount to seller wallet

**FR-15** The system SHALL use the same duration behavior as parity flow: space minimum proposal duration when configured, otherwise fallback default duration.

**FR-16** The system SHALL link `web3ProposalId` back to the Web2 agreement record after successful on-chain proposal creation, matching existing agreement/proposal linkage behavior.

**FR-17** The system SHALL fail creation atomically if on-chain proposal creation fails after Web2 draft creation, deleting the newly created Web2 agreement record before surfacing error state (same rollback policy as parity flow).

### 6.5 Funding and execution UX

**FR-18** The system SHALL provide a treasury funding path (copy address / QR modal) from proposal context using existing wallet-funding primitives so counterparties can deposit required tokens to settlement treasury.

**FR-19** The system SHALL present exchange proposal details using existing proposal detail components plus exchange-specific rendering for both legs, without regressing existing transfer proposal displays.

---

## 7. Non-functional requirements

**NFR-1** The implementation SHALL maximize component reuse from existing proposal flows and SHALL avoid introducing duplicate custom field components when equivalent components already exist.

**NFR-2** The create flow SHALL preserve current orchestrator UX semantics: progress steps, keep-window-open messaging, reset-on-error behavior.

**NFR-3** The contract call path SHALL remain network-compatible with current Base chain configuration and existing smart wallet execution path.

**NFR-4** All new user-facing labels/messages SHALL be added to existing i18n message namespaces and SHALL not hardcode visible strings in components.

**NFR-5** The solution SHALL not require smart contract changes for the initial release scope.

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
Then Web2 agreement is created, Web3 proposal is created via `createProposal`, files are uploaded, and `web3ProposalId` is linked in Web2.

**AC-6** Given Web3 proposal creation fails after Web2 agreement creation,  
When orchestration handles the failure,  
Then the created Web2 agreement is deleted and the user sees recoverable error/reset state.

**AC-7** Given an accepted exchange proposal needs funding,  
When a participant selects funding action,  
Then treasury wallet funding UX (address copy / QR) is available.

**AC-8** Given an exchange proposal is opened in proposal detail,  
When proposal metadata is rendered,  
Then both seller and buyer legs are displayed clearly with wallet + token + amount context.

---

## 9. Reuse map (clean implementation baseline)

- Reuse create page + side panel wiring pattern from `pay-for-expenses`.
- Reuse `CreateAgreementBaseFields`.
- Reuse recipient selector + manual address component pattern for both seller and buyer.
- Reuse token payout row and field-array pattern for both exchange legs.
- Reuse orchestrator task state machine pattern (`CREATE_WEB2`, `CREATE_WEB3`, `UPLOAD_FILES`, `LINK`).
- Reuse proposal details decoding/rendering infrastructure and extend only where necessary for exchange-specific labeling.
- Reuse wallet funding modal/QR integration for treasury deposit flow.

---

## 10. Open questions / decisions required

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| OQ-1 | For “native token” support in buyer leg, do we support true native asset transfer in V1 or constrain to ERC-20 tokens only? | Product + Engineering | Open |
| OQ-2 | Should seller funding also expose explicit QR/copy flow, or only buyer per current issue text? | Product | Open |
| OQ-3 | Should exchange details be represented in dedicated structured fields on the document model, markdown payload, or both? | Engineering | Open |
| OQ-4 | Is partial settlement (one leg funded, one unfunded) allowed to remain pending execution, or should UI block execution attempts until both legs are funded? | Product + Engineering | Open |

---

## 11. Implementation ticket decomposition (for execution)

- **T-1 Action & routing:** enable create action, route, and i18n copy updates.
- **T-2 Form schema:** add exchange schema + validation (seller, buyer, dual payout arrays).
- **T-3 Plugin UI:** implement exchange plugin using reusable recipient/payout components for both sides.
- **T-4 Orchestrator + Web3 mutation:** implement parity lifecycle + transaction mapping for bilateral settlement.
- **T-5 Proposal detail rendering:** add exchange-specific proposal display/parsing where needed.
- **T-6 Funding UX linkage:** expose treasury deposit (QR/copy) action in relevant exchange context.
- **T-7 QA coverage:** add/create-path and orchestration tests (success + rollback path).

---

## 12. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-03-28 | Requirements (agent) | Initial draft spec for issue #743 with pay-for-expenses parity and contract integration definition. |
