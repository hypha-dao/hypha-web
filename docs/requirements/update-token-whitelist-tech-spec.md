# Technical Specification — Update Token Proposal Whitelist Parity & Reliability

## Document control

| Field | Value |
|-------|--------|
| **Status** | Draft for implementation |
| **Scope** | Update Issued Token proposals: whitelist read, toggle, add/remove addresses (members & spaces), execution success |
| **Related** | Issue-token deploy flow; `decayingSpaceTokenAbi`; DAO proposal execution |

---

## 1) Problem statement (observed)

- **Symptom:** Update-token proposals that include whitelist changes **fail on execution** (users see generic treasury/funding errors in UI; underlying revert may differ).
- **Contrast:** Issue-token proposals can **deploy** tokens with `initialTransferWhitelist` / `initialReceiveWhitelist` and toggles via factory `deployToken` / `deployDecayingToken` / `deployOwnershipToken`.
- **Expectation:** Update-token proposals should support the same **semantic** whitelist operations **post-deploy**: read current lists, enable/disable enforcement, add/remove allowed addresses (space treasury addresses are still `0x` addresses on-chain).

**Confidence (meta-cognitive):** The failure is **most likely** explained by (a) **calldata / ordering / partial-update** mismatches between app encoding and contract requirements, or (b) **execution context** (gas/treasury), not by “ERC20 approval to a whitelist contract.” Transfer/receive whitelists on the space token are **admin functions on the token contract** invoked through the **DAO proposal executor**, not a separate spender approval flow.

---

## 2) Source-of-truth contract model (ABI / generated)

The app integrates against **`decayingSpaceTokenAbi`** (`packages/core/src/generated.ts`), not the minimal `RegularSpaceToken.sol` snapshot in this repo (that file is ~111 lines and contains **no** whitelist methods). **Deployed** space tokens expose at least:

| Concern | Functions (representative) |
|---------|---------------------------|
| Enable/disable enforcement | `setUseTransferWhitelist(bool)`, `setUseReceiveWhitelist(bool)` |
| Set allowed addresses (batch) | `batchSetTransferWhitelist(address[] accounts, bool[] allowed)`, `batchSetReceiveWhitelist(address[] accounts, bool[] allowed)` |
| Read flags | `useTransferWhitelist()`, `useReceiveWhitelist()` (views) |
| Read / space-scoped helpers | e.g. `getTransferWhitelistedSpaces`, `isTransferWhitelistedSpace`, … (used for richer integrations if needed) |

**Design implication:** “Spaces” in the UI resolve to **blockchain addresses** (space contract / treasury). The chain stores **addresses**, not DB space rows.

---

## 3) Reference integration — Issue New Token (working baseline)

**Orchestrator:** `packages/core/src/governance/client/hooks/useIssueNewTokenOrchestrator.ts`  
**Web3:** `packages/core/src/governance/client/hooks/useIssueNewTokenMutations.web3.rsc.ts`

**Behavior (utility / credits / impact / community_currency path):**

1. Compute `useTransferWhitelist` / `useReceiveWhitelist` from **non-empty** `transferWhitelist.from` / `.to` when advanced controls are on.
2. Map form entries to **`initialTransferWhitelist`** / **`initialReceiveWhitelist`** as `address[]` (filtered to valid `0x` strings).
3. Single factory tx: `deployToken(..., useTransferWhitelist, useReceiveWhitelist, initialTransferWhitelist, initialReceiveWhitelist, ...)`.

**Key property:** Addresses and toggles are applied **atomically at deploy** inside the factory initializer path the protocol expects.

---

## 4) Current integration — Update Issued Token (target state to verify)

**Orchestrator:** `packages/core/src/governance/client/hooks/useUpdateIssuedTokenOrchestrator.ts`  
**Tx builder:** `packages/core/src/governance/client/hooks/useUpdateIssuedTokenMutations.web3.rpc.ts` — `buildUpdateIssuedTokenTxData`

**Implemented direction (must stay aligned with spec):**

1. **Partial updates** driven by `changedTopLevelKeys` from the form.
2. **Whitelist branch:** When `enableAdvancedTransferControls` / `transferWhitelist` is dirty:
   - Derive boolean toggles from **presence of entries** in `from` / `to` lists (mirrors issue-token semantics).
   - Emit **`batchSetTransferWhitelist` / `batchSetReceiveWhitelist`** with `(accounts, allowed[])` for **allowed = true** entries when lists are non-empty.
   - Emit **`setUseTransferWhitelist` / `setUseReceiveWhitelist`** — ordering relative to batch calls must match **contract expectations** (seed membership before toggling enforcement, analogous to deploy ordering).
3. **Non-transferable tokens:** Product rule: if `transferable === false`, do **not** enable on-chain whitelist enforcement (contract may forbid or behave inconsistently).

**Off-chain persistence:** `TokenUpdateData.transferWhitelist` JSON for proposal detail / resubmit (not a substitute for chain state).

---

## 5) Gap analysis (requirements vs implementation)

| ID | Requirement | Risk if unmet |
|----|----------------|---------------|
| **R1** | Proposal calldata must be **valid** for the deployed token (correct function names, arg shapes, ordering). | Execution **reverts**; UI may show generic “treasury” error. |
| **R2** | **Read** current whitelist state when editing: at minimum **on-chain** flags + addresses (via views or indexed iteration); optionally hydrate form from **issue-token** initial state for tokens that already have lists. | Users **overwrite** or **duplicate** state; unexpected batch txs. |
| **R3** | **Enable/disable** maps to `setUse*` only when consistent with **transferable** and non-empty lists policy. | Revert or locked token behavior. |
| **R4** | **Add/remove** addresses maps to `batchSet*` with `allowed: true` for adds; **removals** require `allowed: false` (or equivalent) for removed addresses — **delta vs full replace** must be defined. | Orphaned allow rules or failed txs. |
| **R5** | Proposal details UI shows **From/To** lists for update-token (decoded `batchSet*` + pending JSON), comparable to issue-token display. | Operators cannot audit what will execute. |
| **R6** | Execution failure diagnostics: surface **revert reason** or link to explorer, not only generic treasury copy. | Misdiagnosis (funds vs access vs require). |

---

## 6) Functional requirements (numbered for traceability)

### FR-1 — Fetch existing whitelists (issue-token + on-chain)

- **FR-1.1** When opening Update Issued Token for a token, the form SHALL hydrate whitelist UI from:
  - **On-chain** `useTransferWhitelist`, `useReceiveWhitelist`, and **membership** for addresses (minimum: whatever the contract exposes as getters; if only batch mappings exist, use `multicall` or iterative reads per known space/member address from DB).
  - **Optional:** merge with `token_updates.data.transferWhitelist` if present (pending proposal overlay).
- **FR-1.2** If the token was issued with issue-token initial lists, those addresses SHALL appear in the form **unless** removed on-chain afterward (chain wins on conflict).

### FR-2 — Enable / disable whitelists

- **FR-2.1** Toggling advanced controls off SHALL encode **both** flags false and **not** leave stale allow rules that contradict product intent (define: either leave memberships as-is but disabled, or clear via batch — **decision required**, see §8).
- **FR-2.2** When `transferable` is false, the app SHALL NOT emit `setUse*` true for whitelists (already a product constraint; keep enforced in orchestrator).

### FR-3 — Add / remove addresses and spaces

- **FR-3.1** **Add:** encode `batchSet*` with `allowed[i] = true` for new addresses (same as current implementation direction).
- **FR-3.2** **Remove:** encode `batchSet*` with `allowed[i] = false` for addresses removed from the form compared to **baseline state** (baseline = on-chain state at edit open, or last known).
- **FR-3.3** Space rows SHALL continue to resolve to **space contract addresses** (same as issue-token); member rows use **member wallet addresses**.

### FR-4 — Parity with issue-token encoding

- **FR-4.1** Address arrays passed to `batchSet*` SHALL be checksum-agnostic but **valid** `0x` addresses (same filtering as issue-token).
- **FR-4.2** Transaction **ordering** in the proposal SHALL match deploy semantics: **apply membership changes before enabling enforcement** if the contract requires it (verify with on-chain revert tests).

### FR-5 — Proposal details & resubmit

- **FR-5.1** Proposal detail SHALL decode `batchSet*` txs into human-readable From/To lists (addresses + `WhitelistAddressItem` resolution).
- **FR-5.2** Resubmit payload SHALL include `transferWhitelist` JSON for form hydration.

---

## 7) Non-functional requirements

- **NFR-1** Gas: proposal tx count SHOULD be minimized (batch sets vs one call per address) within DAO limits.
- **NFR-2** Observability: log or display **revert data** when simulation fails (optional: Tenderly or `eth_call` before submit).
- **NFR-3** Security: no new privileged roles in app code; only executor-via-proposal path.

---

## 8) Open decisions (must be closed in implementation)

1. **Removal semantics:** When user deletes an entry in the form, MUST emit `allowed: false` for that address in the same proposal as adds, or a separate “clear all” strategy.
2. **Baseline for diff:** Hydrate “before” state from **chain only** vs **chain + pending token update** — specify single source of truth.
3. **Contract line ~601:** The linked `RegularSpaceToken.sol` revision in GitHub may **differ** from deployed bytecode; implementation MUST verify against **`decayingSpaceTokenAbi`** and/or verified deployment artifact, not file line numbers alone.

---

## 9) Verification & acceptance criteria

| Test | Pass criteria |
|------|----------------|
| **VT-1** Issue-token deploy with whitelists → token shows correct flags + membership on-chain | Matches factory intent |
| **VT-2** Update-token proposal: toggle only | Only `setUse*` in calldata when consistent |
| **VT-3** Update-token proposal: add one address | `batchSet*` with `true` then appropriate `setUse*` ordering |
| **VT-4** Update-token proposal: remove one address | `batchSet*` includes `false` for removed |
| **VT-5** Execution | Proposal executes without revert on testnet/mainnet fork |
| **VT-6** UI | Proposal detail shows From/To lists for update-token |

---

## 10) Implementation map (code touchpoints)

| Layer | Files / components |
|-------|---------------------|
| Tx encoding | `useUpdateIssuedTokenMutations.web3.rpc.ts` (`buildUpdateIssuedTokenTxData`) |
| Partial update selection | `useUpdateIssuedTokenOrchestrator.ts` (`buildPartialUpdateIssuedTokenWeb3Input`, `whitelistAddressesFromForm`) |
| Decode proposal | `decoders.ts`, `useProposalDetails.web3.rpc.ts` |
| Form / hydration | `update-issued-token/plugin.tsx`, `useTokenOnChainData.ts`, page-level `spaces`/`members` props (parity with issue-new-token page) |
| Details UI | `proposal-update-token.tsx` |
| Persistence | `TokenUpdateData.transferWhitelist`, `createTokenUpdate` |

---

## 11) Meta-cognitive note

Hypotheses ranked by likelihood for “all whitelist update proposals fail”:

1. **Calldata / ordering / missing removal txs** causing deterministic revert (**high** — fix by spec §6–8).
2. **Treasury / executor funding** for proposal execution (**medium** — orthogonal; improve error surfacing).
3. **Missing approval to a separate whitelist contract** (**low** for this architecture — token admin functions, not ERC20 allowance).

Validate (1) with a **trace of the failing proposal** before expanding scope.

---

## 12) References (in-repo)

- Issue-token orchestration: `packages/core/src/governance/client/hooks/useIssueNewTokenOrchestrator.ts`
- Update-token orchestration: `packages/core/src/governance/client/hooks/useUpdateIssuedTokenOrchestrator.ts`
- ABI: `packages/core/src/generated.ts` (`decayingSpaceTokenAbi`)
- Minimal base token (no whitelist): `packages/storage-evm/contracts/RegularSpaceToken.sol`
