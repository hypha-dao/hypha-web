# OSwaps: How Close Is the Solidity Port to Chuck's Original Protocol?

This document answers a specific question: the Solidity `OSwaps.sol` in this folder is a port of the
Antelope/EOSIO `oswaps` contract designed by Chuck for the Seeds ecosystem. **How faithful is it?**

It is written to be read start to finish by a human. For the mechanical contract reference — every
function, parameter, revert, and the code a UI needs — see
[`OSwaps.docs.md`](./OSwaps.docs.md).

The sources compared are all in this directory:

| File                  | What it is                                                                     |
| --------------------- | ------------------------------------------------------------------------------ |
| `oswaps.hpp`          | Chuck's original header, with the protocol's design intent in its doc comments |
| `oswaps.cpp`          | The original EOSIO/Antelope implementation                                     |
| `OSwaps.sol`          | The Solidity port under review                                                 |
| `ISeedsEcosystem.sol` | Solidity interface declarations for the port                                   |

---

## 1. The short answer

**The economic model is faithfully reproduced. The numerical implementation of it is not.**

Every action in the original has a counterpart, and the parts that matter conceptually — the
Balancer invariant, single-sided liquidity with weight adjustment, the "weight zero means hold the
price" convention, the freeze-on-reprice safety rule, manager-gated withdrawal, LIQ receipt tokens
issued 1:1 — all survive the translation intact and behave the same way. Someone who understood the
original protocol will recognise this contract and will not be surprised by how it behaves.

The EOSIO version's rearchitecting for EVM is also mostly well judged. The original's most awkward
feature — a two-action "prep then transfer" choreography needed because EOSIO tokens push rather
than pull — is correctly collapsed into ordinary pull-based functions, which is what an EVM port
should do.

What did not survive is the arithmetic. The original called the C standard library's `log()` and
`exp()` on IEEE doubles: accurate to roughly 15 significant digits across the whole useful domain.
The port substitutes hand-written Taylor series that are accurate for small trades, visibly wrong
for large ones, and mathematically divergent past a hard boundary. The pool prices correctly for
trades up to roughly 40–50% of the relevant pool balance and misprices or reverts beyond that. Nobody
can steal from it outright — out-of-range trades revert, and we could not construct a profitable
standalone attack — but the two swap directions are _not_ equally safe: `swapExactIn` errs in the
pool's favour, while `swapExactOut` errs against it and can break the invariant by as much as 16.8% on
a single large trade, at liquidity providers' expense. That is a real functional gap any production
use has to close.

Beyond the math, a handful of smaller divergences are worth knowing about, and one of them —
`emergencyWithdraw` — is a departure from the original's _trust model_ rather than its mechanics,
which makes it the most philosophically significant change in the port.

A caveat on the baseline: `oswaps.hpp` describes itself as a Proof of Concept and lists exchange
fees, liquidity metering, and multichain operation as deliberately unimplemented. The Solidity port
omits all three too, so on those points it is faithful to what actually existed. Judgements below
are against the original as written, not against a hypothetical finished protocol.

---

## 2. Action-by-action mapping

| EOSIO action                                               | Solidity                                       | Fidelity                                                 |
| ---------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `createasseta(actor, chain, contract, symbol, meta)`       | `createAsset(tokenContract, symbol, metadata)` | Close. `chain` dropped; LIQ precision and naming changed |
| `forgetasset(actor, token_id, memo)`                       | `forgetAsset(tokenId)`                         | Partial. Does not clean up the LIQ token                 |
| `querypool(token_id_list)`                                 | `queryPool(tokenIdList)`                       | Faithful                                                 |
| `freeze(actor, token_id, symbol)`                          | `freeze(tokenId, symbol)`                      | Faithful, including the symbol typo guard                |
| `unfreeze(actor, token_id, symbol)`                        | `unfreeze(tokenId, symbol)`                    | Faithful                                                 |
| `init(manager, chain)`                                     | `init(manager)`                                | Partial. One-shot; no manager rotation                   |
| `addliqprep` + `ontransfer`                                | `addLiquidity(tokenId, amount, weight)`        | Correctly collapsed. One dropped guard                   |
| `exprepfrom` + `ontransfer`                                | `swapExactIn(...)`                             | Correctly collapsed. Math differs                        |
| `exprepto` + `ontransfer`                                  | `swapExactOut(..., maxInAmount)`               | Correctly collapsed and improved                         |
| `withdraw(account, token_id, amount, weight)`              | `withdraw(account, tokenId, amount, weight)`   | Faithful, including the unusual auth model               |
| `transfer(from, to, quantity, memo)` (LIQ, p2p-restricted) | `LiquidityToken` plain ERC-20                  | **Diverges.** Restriction lost                           |
| `retire(quantity, memo)`                                   | `LiquidityToken.burnFrom`                      | Equivalent                                               |
| `ontransfer` fallback for unsolicited transfers            | —                                              | Naturally not applicable                                 |
| `save_transaction` / `txx` singleton                       | —                                              | Correctly eliminated                                     |
| `reset()`                                                  | —                                              | Missing                                                  |
| `resetacct(account)`                                       | —                                              | Not applicable — no internal balance tables              |
| —                                                          | `emergencyWithdraw(token, amount)`             | **Added.** No counterpart in the original                |

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

and the port computes the same expression in fixed point. `swapExactOut` likewise mirrors the
original's inverted form with `wOut/wIn`. Setting aside the accuracy of `ln` and `exp` themselves,
the algebra is a correct transcription.

### Single-sided liquidity and the weight convention

The heart of the protocol. `weight = 0` means "recompute my weight so the price does not move," and
both implementations use the same algebra. The original:

```cpp
new_weight = a->weight * (1.0 + float(amount64) / bal_before);   // deposit
new_weight = a->weight * (1.0 - float(amount64) / bal_before);   // withdraw
```

The port rearranges these to avoid fractional intermediates —
`weight * (balBefore + amount) / balBefore` — which is algebraically identical and the right way to
do it in integer arithmetic.

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
without consulting allowances. Different mechanism, same trust model — this is faithful, and worth
saying explicitly because it looks like an EVM-specific liberty and is not.

### Other faithful details

The strict `bal_before > amount` check on withdrawal, so the pool can never be emptied through that
path. New assets starting inactive with zero weight. `querypool` reverting on an unknown id rather
than skipping it. Permissionless asset creation and permissionless deposits. LIQ minted 1:1 with the
nominal deposit rather than as a proportional share. Reading pool balances live rather than tracking
them internally. No exchange fees. And no minimum-output guard on the exact-in swap — the original
had none either, so the port is faithful here even though the omission is far more dangerous on a
public EVM mempool than on Antelope.

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
functions. This is the right call and it is executed cleanly — the elimination of `save_transaction`
and the `txx` table is a genuine simplification rather than a lost feature.

### Replacing the surplus refund with an exact pull

Because EOSIO could not pull funds, `exprepto` (exact output) required the sender to transfer _at
least_ enough and then refunded the difference:

```cpp
in_surplus = quantity.amount - computed_amt;
check(in_surplus >= 0, "insufficient amount transferred in");
// ... later: transfer overpayment back to sender
```

`swapExactOut` instead computes the exact input, checks it against a caller-supplied `maxInAmount`,
and pulls precisely that. This is strictly better: no overpayment, no refund transfer, no
round-trip. The `maxInAmount` parameter is a genuine addition with no original counterpart, and it
is the right idiom for EVM.

### Reentrancy protection

`nonReentrant` on all three value-moving functions. There is no analogous hazard in the EOSIO model,
so this is a necessary EVM-specific addition.

### Dropping the chain plumbing

The original carried `chain` parameters and a `chain_code` index on the asset table in anticipation
of cross-chain operation, but only ever accepted `"Telos"`:

```cpp
check(chain == chain_name, "currently only Telos chain supported");
```

Dropping this from a single-chain EVM deployment is reasonable. The port does leave a vestige behind,
which is discussed below.

---

## 5. Divergences that are regressions

Ordered by significance.

### 5.1 The arithmetic — the port's central weakness

Covered in detail in §6. This is the one item that would block production use.

### 5.2 `emergencyWithdraw` breaks the original trust model

This has no counterpart in the original and is the port's sharpest philosophical departure. Chuck's
header is unusually explicit that the owner is meant to be powerless after setup:

> The contract account owner permission should be a "cold" multisig which is used once for
> uploading the contract and once for specifying a manager account. **It has no operational role
> after that**, however for test purposes the `reset` action is implemented.

The port gives the owner a permanent, unrestricted ability to move any token out of the pool:

```solidity
function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
  require(IERC20(token).transfer(owner(), amount), 'Transfer failed');
}
```

No timelock, no event, no restriction to registered assets, no cap. Depositors are fully exposed to
the owner key. This inverts a designed property of the protocol — that the operational role sits with
a governance-controlled manager while the owner stays cold — and it should be either removed or
narrowed and timelocked before anyone is asked to supply liquidity.

### 5.3 LIQ tokens lost their precision

The original deliberately matched the LIQ token's precision to the underlying token's, reading it
from the token's own stats table:

```cpp
auto liq_sym = eosio::symbol(liq_sym_code, ast->supply.symbol.precision());
```

The port's `LiquidityToken` is a plain OpenZeppelin ERC-20, so it always has 18 decimals, while LIQ
is still minted 1:1 against the raw deposit. Deposit 1 USDC and you receive `1e6` base units of an
18-decimal token — displayed naively, `0.000000000001 LIQ`. The accounting still works because mint
and burn are symmetric, but every display path has to special-case it. Since the original did the
work to get this right, the loss is a straightforward regression.

The naming scheme also changed. The original generated base-26 alphabetic suffixes via `sym_from_id`
(`LIQA`, `LIQB`, … `LIQAA`) because Antelope symbol codes must be uppercase letters. The port uses
decimal (`LIQ1`, `LIQ2`). Cosmetic, and arguably clearer, but a difference worth noting since it
changes how these tokens appear in wallets.

### 5.4 LIQ receipts became freely tradeable

The original explicitly blocked peer-to-peer trade in liquidity receipts, routing every transfer
through the contract:

```cpp
check( from == get_self() || to == get_self(),
       "oswaps token transfers must be to/from contract");
// should this no-p2p restriction be under manager config control?
```

The comment shows this was a considered design decision with a known open question, not an accident.
The port's `LiquidityToken` is an unrestricted ERC-20, so receipts can be traded, lent, or used as
collateral. Combined with the fact that `withdraw` burns from whatever address the manager names,
this changes who can be made whole: the manager must now check current LIQ balances rather than
assuming the depositor still holds the receipt.

### 5.5 A dropped guard lets weights be silently zero

The original refuses to compute a price-preserving weight when there is nothing to preserve:

```cpp
if(new_weight == 0.0) {
  check(bal_before > 0, "zero weight requires existing balance");
  new_weight = a->weight * (1.0 + float(amount64)/bal_before);
}
```

The port folds that condition into the `if` instead of asserting it:

```solidity
if (weight == 0 && balBefore > 0) {
  newWeight = (assets[tokenId].weight * (balBefore + amount)) / balBefore;
}
```

When `balBefore == 0`, the original reverts with a clear message; the port silently leaves the weight
at zero. Since the weight is a divisor in the pricing math, every later swap out of that asset then
fails with a division-by-zero panic, and the asset stays bricked until a manager reprices it. A
deliberate guard was converted into a silent failure mode — one of those small transcription
slips that produces a confusing bug much later.

### 5.6 `init` cannot rotate the manager

The original supports reconfiguration, gating it on the incumbent manager:

```cpp
bool reconfig = configset.exists();
if(reconfig) { require_auth(cfg.manager); } else { require_auth2(get_self().value, "owner"_n.value); }
```

The header states the intent: "The manager account may transfer authority to a replacement manager
account." The port's `init` reverts on any second call, so the manager is fixed forever at
deployment. Losing that key permanently disables freeze, unfreeze, withdraw, and forgetAsset — and
because withdrawal is manager-only, it permanently traps all liquidity. This is a designed capability
that was dropped, and it matters more here than it did on Antelope.

### 5.7 `forgetAsset` does not finish the job

The original also erases the LIQ token's stats rows, and flags the remaining untidiness in a
comment:

```cpp
// should we check for zero balance before destroying LIQ token?
// accounts table has stranded ram & data which could create weirdness
```

The port deletes only the asset record, leaving `liquidityTokens[tokenId]` populated and the id in
the `tokenIds` array, with the LIQ token still live and mintable-in-principle. As in the original
there is no zero-balance check, so any remaining pool balance becomes unreachable — except that here
`emergencyWithdraw` provides a recovery path the original lacked. Roughly as untidy as the original,
in slightly different places.

### 5.8 `reset` and validation dropped

`reset()` and `resetacct()` are gone. `resetacct` is genuinely inapplicable — the port has no
internal balance tables — and `reset` was explicitly "for test purposes," so this is minor. Worth
noting only because `emergencyWithdraw` appears to have been introduced in their place while granting
much broader powers than either.

The port also validates less at asset creation. The original had to stat the token's supply to read
its precision, which incidentally proved the token existed:

```cpp
auto ast = astattable.require_find(symbol.raw(), "can't stat symbol");
```

`createAsset` checks only that the address is not the pool itself. It does not verify the target is a
contract, does not detect duplicate registration, and never reads the token's real symbol or
decimals — the `symbol` argument is an unchecked label. On Antelope, RAM costs also made spamming the
asset table expensive; on EVM only gas limits it.

### 5.9 A vestigial `chainId`

With the chain plumbing removed, one fragment was left behind in a broken state:

```solidity
config.chainId = blockhash(block.number - 1);
```

In the original, `chain_id` held the actual Telos chain id and indexed the asset table for future
cross-chain identification. Here it is set to a block hash — not a chain identifier by any
definition — and never read again. If the field is kept it should be `block.chainid`; otherwise it
should be deleted along with the rest of the multichain scaffolding.

---

## 6. The arithmetic, in detail

This deserves its own section because it is the gap between "faithful port" and "production ready."

### What the original did

EOSIO contracts have the C standard library. `oswaps.cpp` uses `log()` and `exp()` on IEEE
double-precision floats — roughly 15 to 16 significant digits, valid across the entire useful
domain, with no trade-size constraint arising from the math itself. Weights are stored as `float`.

### What the port does

Solidity has no floating point, so the port implements both functions from scratch in 18-decimal
fixed point: a 10-term Taylor series for `ln` expanded about `x = 1`, and a 20-term Taylor series
for `exp`.

The `ln` choice is the problem. A Taylor expansion of `ln(x)` about `x = 1` converges only for
`0 < x < 2`, and slowly near the edges. The argument here is
`inBalAfter / inBalBefore = 1 + inAmount / inBalBefore`, so the series' domain limit translates
directly into a limit on **trade size as a fraction of the input-side pool balance.** At `x = 2` —
a trade equal to the entire input balance — the series has not converged; beyond it, it diverges and
produces garbage.

### Measured error

Comparing the port's fixed-point result against exact arithmetic, at equal weights. The two swap
directions feed `ln` different ratios, so they have different envelopes — and, importantly, **their
errors point in opposite directions.**

`swapExactIn`, where the constraint is trade size against the input-side balance. Errors here
underpay the trader, so the pool gains:

| Trade size vs input balance | `ln` argument | Error in output | Verdict     |
| --------------------------- | ------------- | --------------- | ----------- |
| 1% – 30%                    | 1.01 – 1.30   | < 0.0001%       | Accurate    |
| 40%                         | 1.40          | −0.0007%        | Accurate    |
| 50%                         | 1.50          | −0.0061%        | Acceptable  |
| 60%                         | 1.60          | −0.036%         | Degraded    |
| 75%                         | 1.75          | −0.30%          | Degraded    |
| 90%                         | 1.90          | −1.75%          | Badly wrong |
| 100%                        | 2.00          | −4.87%          | Badly wrong |
| 125%                        | 2.25          | −51%            | Badly wrong |
| ≥ 150%                      | ≥ 2.50        | —               | Reverts     |

`swapExactOut`, where the constraint is the requested output against the output-side balance. Errors
here undercharge the trader, so the pool loses:

| Output vs output balance | `ln` argument | Error in required input | Invariant `V` change |
| ------------------------ | ------------- | ----------------------- | -------------------- |
| 1% – 25%                 | 0.99 – 0.75   | < 0.0001%               | ~0                   |
| 33%                      | 0.67          | −0.0002%                | −0.00002%            |
| 40%                      | 0.60          | −0.0015%                | −0.0001%             |
| 50%                      | 0.50          | −0.017%                 | −0.008%              |
| 60%                      | 0.40          | −0.12%                  | −0.06%               |
| 75%                      | 0.25          | −1.67%                  | −1.26%               |
| 90%                      | 0.10          | −18.7%                  | −16.8%               |

The weight ratio constrains things independently, because the exponent is `-(wIn/wOut) * ln(ratio)`
and `exp` also loses accuracy for large arguments. At a 10% trade size, weight ratios up to about
50:1 remain accurate; at 100:1 and beyond the call reverts. Note also that the port's `_exp` returns
badly wrong values for arguments below about −8 — `exp(-10)` evaluates to roughly `13.4` instead of
`0.0000454` — which is what causes those reverts.

### How bad is it, exactly

**No standalone extraction is possible.** Inputs outside the convergent domain revert rather than
executing: when the series diverges, the computed post-swap balance exceeds the pre-swap balance and
the subtraction underflows, which Solidity 0.8 turns into a panic. Within the executable range, we
swept 525 `swapExactOut` configurations — weight ratios from 0.02 to 50, pool imbalance from 1:100 to
100:1, output sizes from 1% to 99% — and found no combination in which a caller can buy the output for
less than its pre-trade spot value. There is no self-contained way to profit off the mispricing,
because the curve price for any non-trivial trade remains worse than spot even after the error.

**But `swapExactOut` does leak liquidity-provider value.** It breaks the invariant downward, by up to
16.8% of `V` on a single large trade. Unlike the exact-in direction, where the approximation error
accrues to the pool, here it accrues to the counterparty. That value is real, and it is captured by
whoever was going to arbitrage the pool anyway. This is the part of the math problem that costs
someone money rather than merely producing a wrong number, and it is why the two directions should not
be treated as equally safe.

**Small trades are genuinely fine.** Below 30% of the relevant balance the error is under one part in
a million in both directions, well inside any sane slippage tolerance. A pool that is large relative
to typical trade size behaves correctly.

### Recommendation

Replace `_ln` and `_exp` with an audited fixed-point library — `PRBMath` or solmate's
`FixedPointMathLib` — both of which provide full-domain `ln` and `exp` with far better accuracy and
comparable or lower gas. That removes the trade-size ceiling, eliminates the envelope reverts, and
brings the port back in line with the original's numerical behaviour.

There is a real tension here worth naming: swapping in a library moves the code _further_ from a
literal transcription of Chuck's C++ while moving it _closer_ to the protocol's actual intended
behaviour. Our view is that fidelity means reproducing intended behaviour, and Chuck's use of
`log()`/`exp()` was a use of the best available primitive rather than a design choice in favour of
truncated series. But it is a judgement call and should be made deliberately rather than by default.

---

## 7. Verdict

| Dimension                                                                         | Assessment                                                                                                  |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Economic model (invariant, weights, single-sided liquidity)                       | Faithful                                                                                                    |
| Action coverage                                                                   | Complete, apart from `reset`                                                                                |
| Semantic rules (freeze-on-reprice, weight-zero, symbol guard, manager-gated exit) | Faithful                                                                                                    |
| EVM rearchitecting (pull vs push, exact-pull swap, reentrancy)                    | Well judged, an improvement                                                                                 |
| Numerical accuracy                                                                | **Materially worse.** Reliable only below ~40–50% of pool balance; `swapExactOut` leaks LP value above that |
| Trust model                                                                       | **Diverges.** `emergencyWithdraw` contradicts the stated cold-owner design                                  |
| LIQ token behaviour                                                               | Diverges on precision and on transfer restrictions                                                          |
| Operational completeness                                                          | Gaps: no manager rotation, incomplete `forgetAsset`, a dropped guard                                        |
| Production readiness                                                              | Not ready. No tests, no deploy script, unresolved math                                                      |

**Summary for the original question.** As a description of the oSwaps protocol, the port is
accurate — it implements Chuck's design, keeps its non-obvious safety rules, and translates the
EOSIO-specific plumbing into idiomatic EVM correctly. As an implementation of that protocol, it is
a proof of concept whose pricing math is only trustworthy for trades that are small relative to pool
size, whose exact-out direction quietly transfers value from liquidity providers to counterparties on
large trades, and which grants the deployer a fund-recovery power the original design deliberately
withheld.

Prioritised remediation, if this is to go anywhere:

1. Replace the Taylor-series math with an audited fixed-point library.
2. Remove or timelock `emergencyWithdraw`.
3. Add a test suite — there is currently none, and the math has never been exercised.
4. Restore the dropped `bal_before > 0` guard in `addLiquidity`.
5. Add manager rotation.
6. Add a `minOutAmount` parameter to `swapExactIn`. Absent in the original too, but MEV on a public
   EVM mempool makes it necessary here in a way it was not on Antelope.
7. Match LIQ decimals to the underlying token, and decide deliberately whether to restore the
   peer-to-peer transfer restriction.
8. Complete `forgetAsset`, or gate it on a zero pool balance.
9. Fix or delete the vestigial `config.chainId`.
