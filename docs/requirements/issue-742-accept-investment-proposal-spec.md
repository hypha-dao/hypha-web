# Issue #742 Specification — Accept Investment Proposal (Escrow)

## 1) Context and traceability

- **GitHub issue:** [hypha-dao/hypha-web#742](https://github.com/hypha-dao/hypha-web/issues/742)
- **Product intent:** Let a space propose terms under which an investor funds the space (treasury) and receives space tokens in return, with settlement mediated by the same **escrow** integration pattern as **Exchange Stakes & Tokens** ([hypha-dao/hypha-web#2066](https://github.com/hypha-dao/hypha-web/pull/2066)).
- **Smart contract baseline:** `EscrowImplementation` (`createEscrow`, `receiveFunds`, optional immediate funding via `_sendFundsNow`, completion when both parties have funded). Reference: `packages/storage-evm/contracts/EscrowImplementation.sol`.
- **Requirements vault note:** The Obsidian requirements skill path referenced in `.agents/roles/senior-requirements-engineer.base.md` is not present in this workspace; this file follows the same structure as `docs/requirements/issue-1727-burn-token-proposal-spec.md` for consistency.

### 1.1 Mapping issue copy to escrow parties

When the **active space** (DAO proposal executor) creates the escrow:

| Issue #742 field (investor-centric) | Escrow role | Escrow field |
|-------------------------------------|-------------|--------------|
| Investing member will **Send** | Investor (counterparty) | `partyB` funds `tokenB` / `amountB` |
| Investing member will **Receive** | Space (creator) | `partyA` funds `tokenA` / `amountA`; on completion, `tokenA` is transferred to `partyB` (investor) |

The proposal **SHALL** encode `createEscrow` such that `msg.sender` at execution time is the **active space’s executor**, so `partyA` is the space and `partyB` is the resolved investor address.

---

## 2) User-facing summary

**US-1** As a member of a space, I want to create an **Accept investment** proposal so that, after the proposal passes, the investor and the space can each fund the escrow under agreed token amounts, and the contract completes the swap when both sides have paid.

**US-2** As a reviewer, I want proposal details to show **payment / transaction rows** clearly, including an **Escrow Account** label when the counterparty of a row is the escrow contract address, so I can distinguish treasury-to-escrow movements from end-recipient transfers.

**US-3** As a reviewer, I want **Investment** proposal details to use the **same presentation model as other proposal types**: a **read-only list of labeled fields** that mirrors the **create** form structure (investing member, send legs, receive legs—including source when applicable—plus shared agreement fields), not only raw on-chain decoding.

**US-4** As a reviewer, I want the **investing member** shown with **avatar (icon), display name** when resolvable from Hypha data, and **fallback to the formatted blockchain address** when no profile or space match exists—consistent with how other proposal detail rows resolve recipients (e.g. person / space / `EthAddress`).

---

## 3) Scope

### 3.1 In scope

- Replace or extend the current **“Accept Investment (Coming Soon)”** create action with a real route, form, plugin, validation schema, and Web2/Web3 orchestration **aligned with the Exchange Stakes & Tokens implementation pattern** (orchestrator stages, `createProposal` batching, linkage via `web3ProposalId`).
- On-chain proposal transactions that use **`EscrowImplementation`** for the investment agreement (including ERC-20 `approve` where required, and `createEscrow` / `receiveFunds` as designed for the product flow).
- **Authority model:** The **active space** (proposal executor) **SHALL** be the on-chain actor that **sends the space’s leg** (`tokenA` / `amountA`) into escrow—i.e. `partyA` funding path—so the space must have the right to move those tokens (treasury balance + allowance, or mint-to-executor then approve/funding, per source selection below).
- Proposal details: decode and present investment/escrow-specific summary (escrow id, legs, funding state) **in addition to** any generic transaction list, and present **Investment** content as a **labeled field list** aligned with the create form (same section order and labels as other agreement-style proposals).
- **Investor identity on details:** resolve and show **icon + name** from member/space/person data where available; otherwise show **`EthAddress`** (or equivalent) for the investor `0x` address.
- **Transaction list:** Any row whose **recipient** (or logical “to” address) is the configured **escrow contract address** for the environment **SHALL** display the visible label **Escrow Account** (see FR-18, AC-5).
- i18n for all new user-visible strings (parity across configured locales).
- Document badge / resubmit label mapping for proposal label **Investment** (or the final canonical label agreed with product—default here: **Investment** per issue #742).

### 3.2 Out of scope (unless pulled in by a separate ticket)

- Investor-wallet UX for **Deposit Funds** / QR flows (assumed existing); this spec covers the **proposal + executor + escrow** path.
- Custodial off-ramp, fiat, or non–Base chains.
- Post-MVP **withdraw / reclaim** flows mentioned in historical issue comments (track as follow-up unless contract already exposes them and product prioritizes them).

---

## 4) Functional requirements

**FR-1** The system SHALL expose **Accept investment** from the global **Create** flow and route to a dedicated create page (slug to be aligned with routing conventions, e.g. `accept-investment`).

**FR-2** The system SHALL create proposals with proposal label **Investment** (hidden preselected action in UI per issue #742) while preserving shared agreement fields: title, image, description, attachments.

**FR-3** The system SHALL provide **Investing member** identification via (a) member/space search selector and (b) manual EVM address entry, resolving to a single **`0x` address** used as escrow `partyB`.

**FR-4** The system SHALL provide a repeatable **“Investing member will Send”** section: amount + token, constrained to tokens **referenced in the treasury** (same eligibility rules as comparable treasury flows unless product narrows further).

**FR-5** The system SHALL provide a repeatable **“Investing member will Receive”** section: amount + token + **Source** with values **Mint new tokens** or **Use available tokens in treasury**.

**FR-6** When **Mint new tokens** is selected for a receive leg, the system SHALL include on-chain steps such that, at execution, the **active space** can supply `tokenA` to the escrow (e.g. mint to executor/treasury then fund escrow), without requiring the investor to custody space tokens before paying.

**FR-7** When **Use available tokens in treasury** is selected, the system SHALL ensure funding uses **treasury-held balance** and any required **allowance to the escrow contract** is obtained as part of the proposal’s transaction batch (pattern parity with exchange flow: safe allowance handling for tokens that forbid non-zero → non-zero allowance updates).

**FR-8** The system SHALL submit proposals through the same **Web2 agreement + Web3 `createProposal` + link `web3ProposalId`** orchestration pattern as Exchange Stakes & Tokens.

**FR-9** The system SHALL batch proposal transactions so that after vote execution the executor performs, at minimum: ERC-20 approvals as needed, **`EscrowImplementation.createEscrow`** with parameters consistent with sections 1.1 and 5, and **`receiveFunds`** for the space leg when not fully covered by `createEscrow(..., _sendFundsNow)` alone—exact sequencing SHALL match the chosen encoding documented in the implementation ticket.

**FR-10** The system SHALL use environment-configured **EscrowImplementation** ABI and address (single source of truth; no ad-hoc hardcoding in application code).

**FR-11** The system SHALL decode proposal transactions for display: escrow creation, token movements, and derived **investment legs** (space → escrow, investor → escrow, completion state when queryable).

**FR-12** The system SHALL render **Investment** proposal details **on the same model as other proposal types**: a **structured list of fields** that **maps 1:1 to the create form** (e.g. **Investing member**, **Investing member will Send** rows with amount/token, **Investing member will Receive** rows with amount/token/**Source**, then escrow/on-chain summary blocks such as escrow id, status, per-leg funding guidance, and explorer links as used for Exchange). Shared agreement fields (title, image, description, attachments) SHALL remain in their **standard** position relative to other proposals, not duplicated inside the investment block unless the product pattern already duplicates them elsewhere.

**FR-12a** The system SHALL **retrieve** the investing member’s **display identity** for proposal details by resolving the stored investor address against **person** and **space** records (same hooks or services used elsewhere for address → avatar + name, e.g. patterns in `ProposalTransactionItem` / `usePersonByWeb3Address` and space-by-address lookup).

**FR-12b** The system SHALL **display** the investing member with: **profile or space icon** (avatar/logo), **display name** (person name or space title) when resolution succeeds, and **SHALL fall back** to showing the **blockchain address** (formatted shortened or full per design system, e.g. `EthAddress`) when no person or space matches the investor address.

**FR-13** The system SHALL map proposal label **Investment** to the accept-investment create route in the **resubmit** flow.

**FR-14** The system SHALL add a **document badge** (or equivalent list indicator) for **Investment** proposals, using i18n keys consistent with other proposal types.

**FR-15** The system SHALL validate that all amounts are **finite positive numbers**, addresses are valid, token addresses are in the allowed set, and at least one send row and one receive row exist (or the cardinality rules product finalizes).

**FR-16** The **active space** SHALL be authorized to perform **`safeTransferFrom` source** for the space leg: the address debited for `tokenA` when the space funds escrow MUST be controlled by the proposal executor (treasury or executor-owned balance post-mint).

**FR-17** The system SHALL NOT require the investor to sign space-side transactions; the investor fulfills **their** leg via normal wallet transfer / `receiveFunds` as defined by escrow UX and on-chain rules.

**FR-18** In the **proposal details transaction list** (the section that lists decoded transfer-style rows, e.g. `ProposalTransactionItem` and equivalents), the system SHALL show the label **Escrow Account** for every row where the **recipient** (or displayed counterparty address) equals the configured **escrow contract address** for the deployment.

**FR-19** The system SHALL persist or reconstruct **Investment** create-form field values (including investor address, send/receive legs, and **Source** per receive row) so that proposal details can render them **without relying solely on markdown**; markdown body MAY supplement but MUST NOT be the only source of structured investment fields.

---

## 5) On-chain encoding (normative intent)

Parameters to `createEscrow` SHALL satisfy:

- `_partyB`: resolved investor address.
- `_tokenA` / `_amountA`: token and amount the **space** commits (investor **receives** this on completion).
- `_tokenB` / `_amountB`: token and amount the **investor** must pay (space **receives** this on completion).
- `_sendFundsNow`: set per product/implementation choice; if true, the executor MUST already hold `tokenA` and have approved the escrow for `amountA` in the same execution batch.

**Note:** Completion semantics in `EscrowImplementation` swap legs: `tokenA` → `partyB`, `tokenB` → `partyA`. That matches **investor receives tokenA** and **space receives tokenB**.

---

## 6) Parity constraints

**PAR-1** Web2/Web3 orchestration task states, progress reporting, and error handling SHALL mirror **Exchange Stakes & Tokens** unless a documented exception exists.

**PAR-2** Proposal transaction decoding SHALL remain backward-safe: unknown transaction types MUST NOT break proposal details rendering.

**PAR-3** Token approval patterns SHALL follow the same **safe allowance** strategy required for the exchange flow (e.g. `forceApprove`, reset-to-zero then approve, or `permit` when available—implementation picks one documented approach per token class).

**PAR-4** The **Investment** proposal-details layout SHALL match the **field-list / section** conventions used by comparable flows (e.g. Exchange, mint, burn detail components): section headings, label/value rows, and token rows with **icon + formatted amount + symbol** where those flows do so.

---

## 7) Non-functional requirements

**NFR-1** All new user-visible strings SHALL be internationalized under the same message structure as other agreement flows.

**NFR-2** Escrow contract address and chain id SHALL be resolved from application configuration; missing configuration SHALL fail fast at runtime or build time per project standards.

**NFR-3** Proposal details for Investment SHALL tolerate partially executed proposals (e.g. escrow created but not fully funded) without throwing; show **pending** states.

---

## 8) Acceptance criteria

**AC-1** Given a user opens **Create → Accept investment**, when the form loads, then base fields and the three investment sections (investor, send, receive) are visible and **Investment** is the internal proposal label without exposing a redundant action dropdown.

**AC-2** Given valid form data, when the user submits, then a Web2 document is created, a Web3 proposal is submitted, and `web3ProposalId` is linked.

**AC-3** Given an executed proposal on-chain, when proposal details load, then escrow summary shows escrow id (when derivable), tokens/amounts for both legs, and funding/completion state consistent with chain data.

**AC-3a** Given an **Investment** proposal document, when proposal details render, then the UI shows a **labeled field list** that mirrors the **create** form sections and order (investing member, send legs, receive legs with **Source**), before or adjacent to escrow/transaction summaries per the pattern used for other proposal types.

**AC-3b** Given an investor address that matches a **known member/person** in Hypha, when the investing member row renders, then **avatar and display name** are shown.

**AC-3c** Given an investor address that matches a **known space** by treasury/contract address, when the investing member row renders, then **space logo and title** are shown.

**AC-3d** Given an investor address with **no** matching person or space, when the investing member row renders, then the UI shows the **blockchain address** fallback (e.g. `EthAddress`) and does not show a broken or empty name.

**AC-4** Given the space selected **Use available tokens in treasury** for the receive leg, when the proposal executes, then the space leg can be funded without manual off-proposal allowance steps beyond what the proposal batch performs.

**AC-5** Given a decoded transfer row whose recipient is the escrow contract address, when the transaction list renders, then the UI shows **Escrow Account** alongside (or instead of) the raw address per the design system pattern used for other labels.

**AC-6** Given **Mint new tokens** for the receive leg, when the proposal executes, then token supply and escrow funding are consistent with the agreed amounts (no under-collateralized mint path).

**AC-7** Given a user resubmits an **Investment** proposal from voting UI, when resubmit resolves, then navigation targets the accept-investment create route.

---

## 9) Open questions

**OQ-1** Cardinality: issue #742 shows **Add** on send/receive sections—confirm whether **multiple simultaneous investors** in one escrow are supported or whether v1 is **single investor** (`partyB` one address) with multiple token rows collapsed into one escrow pair.

**OQ-2** Confirm **canonical user-visible name** for the create action (“Accept investment” vs “Accept Investment”) vs **badge label** (“Investment”) for documents.

**OQ-3** If the investor must call `receiveFunds` from their wallet, confirm the **post-execution member guidance** copy and whether Hypha surfaces a **deep link** or checklist (out of scope for contract, in scope for UX copy).

**OQ-4** Historical note in #742: “when … expected amount is received in the treasury”—reconcile with **escrow-first** model: either update stakeholder wording to **escrow funding** or add an explicit **treasury balance gate** in the executor logic (separate FR if required).

---

## 10) Implementation map (expected touchpoints)

Mirror the Exchange Stakes & Tokens PR structure; adjust names for **investment**:

- Create route: `apps/web/.../agreements/create/<accept-investment-slug>/page.tsx`
- Create action wiring: `apps/web/.../select-create-action.tsx`, `plugins.tsx`
- Form + plugin: `packages/epics/src/governance/components/create-accept-investment-form.tsx` (name illustrative), `packages/epics/src/agreements/plugins/accept-investment/plugin.tsx`
- Orchestrator + Web3 mutations: `packages/core/src/governance/client/hooks/useCreateAcceptInvestmentOrchestrator.ts`, `useAcceptInvestmentMutations.web3.*.ts`
- Validation: `packages/core/src/governance/validation.ts` (`schemaAcceptInvestment`)
- Decoders + proposal aggregation: `packages/core/src/governance/client/hooks/decoders.ts`, `useProposalDetails.web3.rpc.ts`
- Proposal detail UI + **transaction list label**: `packages/epics/src/proposals/components/proposal-detail.tsx`, `packages/epics/src/governance/components/proposal-transaction-item.tsx` (extend props/i18n for **Escrow Account**), new `proposal-accept-investment-data.tsx` (or equivalent) implementing **form-parity field list** + **investor row** (reuse `usePersonByWeb3Address`, `useDbSpaces` or shared “resolve address” helper for icon/name/`EthAddress` fallback)
- i18n: `packages/i18n/src/messages/*.json`
- Resubmit mapping: `packages/epics/src/proposals/components/form-voting.tsx`
- Badges: `packages/epics/src/governance/hooks/use-space-documents-with-statuses.ts`

---

## 11) Traceability matrix (issue checklist)

| Issue #742 checkbox | This spec |
|---------------------|-----------|
| Smart contract action "Investment" | Sections 1.1, 5, FR-9–FR-11, FR-16–FR-17 |
| Proposal template | FR-1–FR-8, FR-12–FR-15, FR-12a–FR-12b, FR-19 |

Additional stakeholder requirements from this task:

| Stakeholder ask | This spec |
|-----------------|-----------|
| Active space authority to send tokens to escrow | FR-9, FR-16, Section 5 |
| **Escrow Account** on transaction list | FR-18, AC-5, Section 10 |
| Details mirror create form + investor icon/name/address fallback | FR-12, FR-12a–FR-12b, FR-19, PAR-4, AC-3a–AC-3d, Section 10 |
