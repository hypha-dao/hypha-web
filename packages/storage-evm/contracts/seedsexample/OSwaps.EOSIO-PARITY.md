# OSwaps: How Close Is the Solidity Port to Chuck's Original Protocol?

This document answers a specific question: the Solidity `OSwaps.sol` in this folder is a port of the
Antelope/EOSIO `oswaps` contract designed by Chuck for the Seeds ecosystem. **How faithful is it?**

It is written to be read start to finish by a human. For the mechanical contract reference — every
function, parameter, revert, and what a UI needs — see [`OSwaps.docs.md`](./OSwaps.docs.md).

The sources compared are all in this directory:

| File                  | What it is                                                                     |
| --------------------- | ------------------------------------------------------------------------------ |
| `oswaps.hpp`          | Chuck's original header, with the protocol's design intent in its doc comments |
| `oswaps.cpp`          | The original EOSIO/Antelope implementation                                     |
| `OSwaps.sol`          | The Solidity port under review                                                 |
| `ISeedsEcosystem.sol` | Solidity interface declarations for the port                                   |

> **A note on history.** An earlier revision of this port reproduced the protocol's economics
> faithfully but implemented the arithmetic with hand-written Taylor series that were badly wrong for
> large trades, and it had drifted from the original on several smaller points. That analysis, and
> the remediation it recommended, has been carried out — the contract in this folder is the corrected
> version. §7 records what changed and why, because "which version am I reading?" is otherwise a
> confusing question to answer from the diff alone.

---

## 1. The short answer

**The economic model and the protocol's safety rules are faithfully reproduced. The numerics are
now equivalent to the original's, and a small number of deliberate deviations exist where the EVM
demands them.**

Every action in the original has a counterpart. The parts that matter conceptually — the Balancer
invariant, single-sided liquidity with weight adjustment, the "weight zero means hold the price"
convention, the freeze-on-reprice safety rule, manager-gated withdrawal, the symbol typo guard, LIQ
receipt tokens issued 1:1 and not tradeable peer-to-peer — all survive the translation intact and
behave the same way. Someone who understood the original protocol will recognise this contract and
will not be surprised by how it behaves.

The rearchitecting for EVM is well judged. The original's most awkward feature — a two-action "prep
then transfer" choreography needed because EOSIO tokens push rather than pull — is correctly
collapsed into ordinary pull-based functions, which is what an EVM port should do.

On arithmetic, the port now matches the original's behaviour rather than its literal instruction
sequence. The original called the C standard library's `log()` and `exp()` on IEEE doubles, accurate
to roughly 15 significant digits across the whole useful domain. The port uses PRBMath's fixed-point
`pow`, which is accurate to better than 1e-10 relative across the same domain and has no practical
trade-size ceiling. This is a substitution of primitive, not of formula: the algebra is the same.

Four deliberate deviations remain, each because the EVM makes the original's choice unsafe or
unreachable: a `minOutAmount` slippage floor on the exact-in swap, an exact pull instead of
overpay-and-refund on the exact-out swap, reentrancy guards, and outright rejection of
fee-on-transfer tokens. All four are additions of safety, not changes of economics.

A caveat on the baseline: `oswaps.hpp` describes itself as a Proof of Concept and lists exchange
fees, liquidity metering, and multichain operation as deliberately unimplemented. The Solidity port
omits all three too, so on those points it is faithful to what actually existed. Judgements below
are against the original as written, not against a hypothetical finished protocol.

---

## 2. Action-by-action mapping

| EOSIO action                                               | Solidity                                       | Fidelity                                      |
| ---------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `init(manager, chain)`                                     | `init(manager)` + `setManager(newManager)`     | Faithful. `chain` dropped; rotation preserved |
| `createasseta(actor, chain, contract, symbol, meta)`       | `createAsset(tokenContract, symbol, metadata)` | Close. `chain` dropped; LIQ naming changed    |
| `forgetasset(actor, token_id, memo)`                       | `forgetAsset(tokenId)`                         | Improved. Gated on a zero balance             |
| `querypool(token_id_list)`                                 | `queryPool(tokenIdList)`                       | Faithful                                      |
| `freeze(actor, token_id, symbol)`                          | `freeze(tokenId, symbol)`                      | Faithful, including the symbol typo guard     |
| `unfreeze(actor, token_id, symbol)`                        | `unfreeze(tokenId, symbol)`                    | Faithful                                      |
| `addliqprep` + `ontransfer`                                | `addLiquidity(tokenId, amount, weight)`        | Correctly collapsed                           |
| `exprepfrom` + `ontransfer`                                | `swapExactIn(..., minOutAmount)`               | Correctly collapsed; slippage floor added     |
| `exprepto` + `ontransfer`                                  | `swapExactOut(..., maxInAmount)`               | Correctly collapsed and improved              |
| `withdraw(account, token_id, amount, weight)`              | `withdraw(account, tokenId, amount, weight)`   | Faithful, including the unusual auth model    |
| `transfer(from, to, quantity, memo)` (LIQ, p2p-restricted) | `LiquidityToken`, p2p blocked                  | Faithful                                      |
| `retire(quantity, memo)`                                   | `LiquidityToken.burnFrom`                      | Equivalent                                    |
| `ontransfer` fallback for unsolicited transfers            | —                                              | Naturally not applicable                      |
| `save_transaction` / `txx` singleton                       | —                                              | Correctly eliminated                          |
| `reset()`                                                  | —                                              | Missing. Was explicitly test-only             |
| `resetacct(account)`                                       | —                                              | Not applicable — no internal balance tables   |
| —                                                          | `quoteExactIn` / `quoteExactOut`               | **Added.** Views, no economic effect          |
| —                                                          | `getAsset` / `getTokenIds` / `getAssetCount`   | **Added.** Views, no economic effect          |

---

## 3. What was reproduced correctly

### The pricing model

The invariant, the exponent structure, and the direction of every term match. The original computes:

```cpp
lc  = log((double)in_bal_after / in_bal_before);
lnc = -(ain->weight / aout->weight * lc);
out_bal_after = llround(out_bal_before * exp(lnc));
computed_amt  = out_bal_before - out_bal_after;
```

The port computes the same quantity as a single fractional power, rearranged so the base exceeds one
and the exponent is positive:

```solidity
UD60x18 ratio  = ud(inBalAfter).div(ud(inBalBefore));
UD60x18 factor = ratio.pow(ud(wIn).div(ud(wOut)));
uint256 outBalAfter = ud(outBalBefore).div(factor).unwrap();
```

`x^y` and `exp(y * ln(x))` are the same function; the original decomposed it that way because that is
what `libm` offers. `swapExactOut` likewise mirrors the original's inverted form with `wOut/wIn`.

### Single-sided liquidity and the weight convention

The heart of the protocol. `weight = 0` means "recompute my weight so the price does not move," and
both implementations use the same algebra. The original:

```cpp
new_weight = a->weight * (1.0 + float(amount64) / bal_before);   // deposit
new_weight = a->weight * (1.0 - float(amount64) / bal_before);   // withdraw
```

The port rearranges these to avoid fractional intermediates —
`weight * (balBefore ± amount) / balBefore`, via `Math.mulDiv` so the numerator cannot overflow —
which is algebraically identical and the right way to do it in integer arithmetic.

### Freeze-on-reprice

A subtle rule, and the port gets it exactly right. In the original, a non-zero weight argument means
the operator is deliberately changing the price, and the asset is frozen until a manager reviews it:

```cpp
s.active &= (ap.weight == 0.0);
```

That compound-assignment idiom means "stay as you were if weight is zero, otherwise go inactive."
The port expresses the same logic as `if (weight != 0) { active = false; }`. Equivalent in both
branches. This rule is also why bootstrapping a new asset requires two `unfreeze` calls — an
initially counterintuitive sequence that is inherited from the original, not introduced here.

### The zero-weight guard

The original refuses to compute a price-preserving weight when there is nothing to preserve:

```cpp
if(new_weight == 0.0) {
  check(bal_before > 0, "zero weight requires existing balance");
  new_weight = a->weight * (1.0 + float(amount64)/bal_before);
}
```

The port asserts the same precondition with the same meaning
(`Zero weight requires existing balance`), so a first deposit must establish a price explicitly
rather than silently leaving the weight at zero.

### The symbol confirmation guard

`freeze` and `unfreeze` both take a redundant `symbol` argument that must match what is stored. The
original's rationale, from the header, is to "minimize errors in manually-entered transaction data."
The port keeps it, comparing by `keccak256`. Easy to mistake for dead weight and drop; it was
correctly retained.

### Manager-gated withdrawal, including the surprising part

`withdraw` is manager-only in both, so liquidity providers cannot exit on their own initiative.
More surprisingly, in both implementations the manager can burn a provider's LIQ receipts _without
that provider's consent_. In the original this is not stated outright but follows from the
authorisation logic: `withdraw` sends an inline LIQ transfer authorised by the contract's own
`active` permission, and the transfer handler only demands the sender's authority when the contract
is not already authorised:

```cpp
if (!has_auth(get_self())) {
  require_auth( from ); // only needed if we enable p2p LIQ transfers
}
```

The port reaches the same outcome directly, with the pool calling `burnFrom` on the LIQ token
without consulting allowances. Different mechanism, same trust model — worth saying explicitly
because it looks like an EVM-specific liberty and is not.

### Manager rotation

The original gates reconfiguration on the incumbent manager rather than the owner:

```cpp
bool reconfig = configset.exists();
if(reconfig) { require_auth(cfg.manager); } else { require_auth2(get_self().value, "owner"_n.value); }
```

with the header stating the intent: "The manager account may transfer authority to a replacement
manager account." The port splits this into `init` (owner, once) and `setManager` (incumbent
manager), which is the same two-case authorisation expressed as two functions.

### LIQ receipts are not tradeable

The original explicitly blocked peer-to-peer trade in liquidity receipts, routing every transfer
through the contract:

```cpp
check( from == get_self() || to == get_self(),
       "oswaps token transfers must be to/from contract");
// should this no-p2p restriction be under manager config control?
```

The comment shows this was a considered design decision with a known open question. The port enforces
the same rule in `LiquidityToken._update`, permitting mint, burn, and any transfer involving the pool,
and rejecting account-to-account moves. The open question is left open — making the restriction
manager-configurable would be a protocol change, not a port decision.

### LIQ precision follows the underlying token

The original matched the LIQ token's precision to the underlying token's, reading it from the token's
own stats table:

```cpp
auto liq_sym = eosio::symbol(liq_sym_code, ast->supply.symbol.precision());
```

The port reads `decimals()` from the ERC-20 and passes it to `LiquidityToken`, so 1 USDC deposited
shows as 1.0 LIQ rather than as a raw `1e6` against an 18-decimal token. Tokens that do not answer,
or answer nonsensically, fall back to 18.

### Other faithful details

The strict `bal_before > amount` check on withdrawal for a live asset, so a tradeable pool can never
be emptied. New assets starting inactive with zero weight. `querypool` reverting on an unknown id
rather than skipping it. Permissionless asset creation and permissionless deposits. LIQ minted 1:1
with the nominal deposit rather than as a proportional share. Reading pool balances live rather than
tracking them internally. No exchange fees.

---

## 4. Adaptations that are correct and well judged

### Collapsing prep-and-transfer into direct calls

The original's most distinctive structural feature exists to work around an EOSIO constraint: token
transfers are _pushed_ to the recipient, so a contract cannot pull tokens and cannot know why a
transfer arrived. Chuck's solution was a compound transaction — a "prep" action stating intent,
immediately followed by the transfer — with `save_transaction` serialising and inspecting the whole
transaction to verify the pairing:

```cpp
check(final_action.name == "transfer"_n, "final action must be token transfer");
check(should_be_this_action.name == entry && should_be_this_action.account == get_self(),
      "prep action must be next-to-last in transaction ");
```

The `ontransfer` handler then re-read the stored transaction, dispatched on the prep action's type,
and had to _back out_ the transfer that had already happened to recover the pre-transfer balance:

```cpp
uint64_t in_bal_before = acin->balance.amount - quantity.amount;
```

On EVM, `transferFrom` makes all of this unnecessary. The port reads the balance before pulling
funds, which is the natural inversion and is correct. Three prep actions, a transient singleton, a
transaction-introspection routine, and the entire dispatch layer collapse into three ordinary
functions. The elimination of `save_transaction` and the `txx` table is a genuine simplification
rather than a lost feature.

### Replacing the surplus refund with an exact pull

Because EOSIO could not pull funds, `exprepto` (exact output) required the sender to transfer _at
least_ enough and then refunded the difference:

```cpp
in_surplus = quantity.amount - computed_amt;
check(in_surplus >= 0, "insufficient amount transferred in");
// ... later: transfer overpayment back to sender
```

`swapExactOut` instead computes the exact input, checks it against a caller-supplied `maxInAmount`,
and pulls precisely that. Strictly better: no overpayment, no refund transfer, no round-trip. The
`maxInAmount` parameter has no original counterpart and is the right idiom for EVM.

### A slippage floor on the exact-in swap

The original had no minimum-output parameter, and on Antelope it did not need one — there is no
public mempool in which to front-run a pending action. On EVM, a swap with no output floor is
sandwichable by construction. `swapExactIn` therefore takes `minOutAmount`.

This is the one place where the port adds a parameter that changes the caller's contract rather than
just its plumbing, and it is a deliberate departure: reproducing the original's omission literally
would reproduce a vulnerability that only exists in the new execution environment.

### Reentrancy protection

`nonReentrant` on all three value-moving functions. There is no analogous hazard in the EOSIO model,
so this is a necessary EVM-specific addition. A test drives a malicious ERC-20 that re-enters the
pool mid-payout and confirms the guard rejects it.

### Rejecting fee-on-transfer and rebasing tokens

Both implementations read pool balances live rather than tracking them, which means a token whose
balance changes for reasons other than the pool's own transfers will misprice persistently. Antelope
tokens do not behave this way, so the original never had to consider it. The port verifies after each
inbound transfer that the balance moved by exactly the stated amount, and reverts
`Unexpected balance change` otherwise. This closes a failure mode the original could not have.

### Dropping the chain plumbing

The original carried `chain` parameters and a `chain_code` index on the asset table in anticipation
of cross-chain operation, but only ever accepted `"Telos"`:

```cpp
check(chain == chain_name, "currently only Telos chain supported");
```

Dropping this from a single-chain EVM deployment is reasonable. `config.chainId` is retained and set
to `block.chainid`, preserving the original's record of its home chain; like the original's
`chain_id` in practice, nothing reads it.

---

## 5. Remaining divergences

None of these are regressions in behaviour, but they are differences worth knowing about.

### 5.1 `forgetAsset` is stricter than the original

The original erased the LIQ token's stats rows and flagged the remaining untidiness in a comment:

```cpp
// should we check for zero balance before destroying LIQ token?
// accounts table has stranded ram & data which could create weirdness
```

The port answers that open question with "yes": `forgetAsset` requires a zero pool balance and
clears every mapping and the id list entry. The original's stranded-balance scenario cannot occur.

Making that reachable required one change with no counterpart in the original. The original forbade
emptying an asset unconditionally (`bal_before > amount`), which would have made a funded asset
impossible to retire once the zero-balance gate was added. The port keeps the strict check while the
asset is **active** and relaxes it to `>=` while the asset is **frozen** — a frozen asset is not
tradeable, so a zero balance cannot produce an undefined price. Retirement is therefore
freeze → drain → forget.

The alternative would have been an owner-level rescue hatch, which the original design explicitly
withholds (see §6). Relaxing the drain rule for non-tradeable assets seemed the smaller deviation.

### 5.2 LIQ token naming

The original generated base-26 alphabetic suffixes via `sym_from_id` (`LIQA`, `LIQB`, … `LIQAA`)
because Antelope symbol codes must be uppercase letters. The port uses decimal (`LIQ1`, `LIQ2`).
Cosmetic, and arguably clearer, but it changes how these tokens appear in wallets.

### 5.3 `reset` is gone

`reset()` and `resetacct()` are absent. `resetacct` is genuinely inapplicable — the port has no
internal balance tables — and `reset` was explicitly "for test purposes." Minor.

### 5.4 Less validation at asset creation

The original had to stat the token's supply to read its precision, which incidentally proved the
token existed:

```cpp
auto ast = astattable.require_find(symbol.raw(), "can't stat symbol");
```

The port checks that the address is not the pool, is not zero, has code, and is not already
registered — but does not prove the target is a real ERC-20, and never validates the `symbol`
argument against the token, which remains an unchecked label. On Antelope, RAM costs also made
spamming the asset table expensive; on EVM only gas limits it, so registration remains a
griefing surface and a UI needs an allowlist.

Note also that "has code" no longer distinguishes contracts from accounts as cleanly as it once did:
under EIP-7702 an ordinary account can carry a delegation designator and so report a non-empty
code size. The check catches obvious mistakes, not all of them.

### 5.5 Quote and enumeration views were added

`quoteExactIn`, `quoteExactOut`, `getAsset`, `getTokenIds`, and `getAssetCount` have no counterparts
in the original, which exposed its tables directly to off-chain readers — an affordance EVM does not
provide. They are views with no economic effect. The quote views share the exact code path used by
the swaps, so they cannot drift from execution.

---

## 6. The trust model

Worth its own section, because it is the dimension on which a port is easiest to get wrong without
changing a single formula.

Chuck's header is unusually explicit that the owner is meant to be powerless after setup:

> The contract account owner permission should be a "cold" multisig which is used once for
> uploading the contract and once for specifying a manager account. **It has no operational role
> after that**, however for test purposes the `reset` action is implemented.

The port honours this. `owner` can call `init` once and nothing else; there is no owner-level
withdrawal, no pause, and no upgrade path. Every operational power — freeze, unfreeze, withdraw,
forgetAsset, and rotation of the role itself — sits with `manager`, which the incumbent manager can
hand on but the owner cannot reclaim.

That concentration is the protocol's own design, not an artefact of the port, and it has a sharp
consequence that any deployment has to confront directly: **liquidity providers cannot exit without
the manager.** A lost or hostile manager key traps every deposit. On Antelope the manager was
expected to be a governance-controlled account; the EVM equivalent is a multisig or a Hypha space
`Executor`, and an EOA manager would be a serious misconfiguration rather than a mere inconvenience.

An earlier revision of the port granted the owner an unrestricted `emergencyWithdraw`. That inverted
the designed property above — it made depositors trust the owner key rather than the manager
governance — and it has been removed. The zero-balance gate on `forgetAsset` removes the failure mode
it was ostensibly there to rescue.

---

## 7. What changed from the earlier revision

For readers who saw the previous analysis of this port. Each item was a divergence from the original
or an EVM-specific hazard; all are now closed.

| Item                                                                                               | Resolution                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Taylor-series `_ln`/`_exp`: up to 4.9% error on exact-in, and a 16.8% invariant break on exact-out | Replaced with PRBMath `UD60x18.pow`; error now below 1e-10 relative |
| Hard trade-size ceiling — trades ≥ 150% of the input balance reverted                              | Gone. 100× the pool balance prices correctly at equal weights       |
| `emergencyWithdraw` gave the owner an unrestricted drain                                           | Removed                                                             |
| `addLiquidity` silently left the weight at zero on an empty pool                                   | Restored the original's explicit guard                              |
| No manager rotation — a lost key trapped all liquidity permanently                                 | Added `setManager`, gated on the incumbent manager                  |
| `swapExactIn` had no slippage floor                                                                | Added `minOutAmount`                                                |
| LIQ decimals always 18, regardless of the underlying                                               | Read from the token, with an 18 fallback                            |
| LIQ freely transferable, unlike the original                                                       | Peer-to-peer transfers blocked, matching the original               |
| `forgetAsset` left mappings populated and could strand balances                                    | Full cleanup, gated on a zero balance                               |
| `config.chainId` was set to a block hash                                                           | Set to `block.chainid`                                              |
| `IOSwaps.assets` was ABI-incompatible with the real getter                                         | Interface now declares `getAsset`, which returns a real struct      |
| Zero weight caused a division-by-zero panic deep in the math                                       | Named precondition: `Input/Output weight not set`                   |
| `inTokenId == outTokenId` was not rejected                                                         | Rejected with `Same token`                                          |
| The same token could be registered twice, sharing one balance                                      | Rejected with `Token already registered`                            |
| Raw `require(token.transfer(...))`, breaking on non-standard ERC-20s                               | `SafeERC20` throughout                                              |
| Fee-on-transfer and rebasing tokens mispriced silently                                             | Rejected with `Unexpected balance change`                           |
| Weight changes emitted no event                                                                    | `WeightUpdated`; `forgetAsset` and manager changes also emit now    |
| Dead `onlyActive` modifier                                                                         | Removed                                                             |
| No tests, no deploy script                                                                         | 85-case suite in `test/OSwaps.test.ts`; `scripts/oswaps.deploy.ts`  |

The one judgement call worth restating. Replacing the Taylor series moves the code _further_ from a
literal transcription of Chuck's C++ while moving it _closer_ to the protocol's intended behaviour.
Our view is that fidelity means reproducing intended behaviour, and that `log()`/`exp()` on doubles
was Chuck's use of the best available primitive rather than a design preference for truncated series.
A fixed-point `pow` is the closest EVM equivalent of that primitive.

---

## 8. Verdict

| Dimension                                                                         | Assessment                                                                 |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Economic model (invariant, weights, single-sided liquidity)                       | Faithful                                                                   |
| Action coverage                                                                   | Complete, apart from the test-only `reset`                                 |
| Semantic rules (freeze-on-reprice, weight-zero, symbol guard, manager-gated exit) | Faithful                                                                   |
| EVM rearchitecting (pull vs push, exact-pull swap, reentrancy, slippage floor)    | Well judged; an improvement                                                |
| Numerical accuracy                                                                | Equivalent to the original. < 1e-10 relative error, no practical trade cap |
| Trust model                                                                       | Faithful. Owner is powerless after `init`; all power sits with the manager |
| LIQ token behaviour                                                               | Faithful on precision, 1:1 issuance, and the no-p2p restriction            |
| Operational completeness                                                          | Complete: rotation, full `forgetAsset`, no stranded balances               |
| Production readiness                                                              | **Unaudited.** Tested and deployable, but not reviewed by a third party    |

**Summary for the original question.** As a description of the oSwaps protocol, the port is
accurate: it implements Chuck's design, keeps its non-obvious safety rules, preserves its trust
model, and translates the EOSIO-specific plumbing into idiomatic EVM correctly. As an implementation
of that protocol, its numerics now match the original's across the full useful domain, and the
handful of places where it departs from the original are all additions of safety that the EVM's
execution model demands — a slippage floor, reentrancy guards, rejection of tokens whose balances
move on their own, and a drain rule that makes asset retirement possible without giving the owner a
key to the pool.

The remaining gap to production is not fidelity but assurance: the contract is unaudited, and its
entire operational surface depends on one manager address whose governance a deployment has to choose
deliberately.
