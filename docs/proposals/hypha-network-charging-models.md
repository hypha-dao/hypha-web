# Hypha Network charging models

**Status:** analysis / proposal (not an implementation spec)  
**Scope:** how Hypha Network could charge for platform access. No product code in this PR.  
**Prices below are illustrations only** — not live commitments. The only numeric rates cited as repo facts are the existing on-chain activation constants.

Short cost-driver overview: [hypha-costs-and-charging-overview.md](./hypha-costs-and-charging-overview.md).

Legend: **Fact** = present in this repo today. **Assumption** = product/ops choice this document makes explicit.

---

## 1. What already exists (facts)

Hypha already charges **per space, on-chain**, not by card.

| Surface | What it is | Where |
|---|---|---|
| Space activation | Pay **USDC** (`payForSpaces`) or **HYPHA** (`payInHypha`) for N months on one or more `web3SpaceId`s | `useActivateSpacesMutation` |
| Published rates in UI/code | 44 HYPHA / month; form also uses **11 USDC / month** and `HYPHA_PRICE_USD = 0.25` | `member-home-activation.ts`, `proposal-activate-spaces-data.tsx` |
| Entitlement | `SpacePaymentTracker` on Base: `{ expiryTime, freeTrialUsed }`, `hasSpacePaid`, `isSpaceActive` | `SpacePaymentTracker.sol` |
| Free trial / gate | 30-day trial on first proposal create/vote; then create/vote revert `Subscription inactive` (HyphaToken payment txs exempt) | `DAOProposalsImplementation.sol` |
| Who can pay | Person’s Privy smart wallet, or an **Activate Spaces** proposal (treasury pays) | activate-spaces forms |
| Network spend view | Traction dashboard: monthly USD, events, per-space status (Hypha platform spaces) | `platform/server/paying-spaces.ts` |
| Card / Stripe | **None** — no SDK, invoice tables, or checkout routes | — |
| “Subscriptions” in UI | Activation badge (paid / trial / expired) **or** OneSignal prefs — not card billing | `subscription-badge.tsx` |
| Bridge banking | KYB + fiat rails for **treasury transfers**; Hypha stores `bank_customers` pointers only | ADR 0002 |

**Do not reuse Bridge as SaaS billing.** It is a banking processor for space/person deposits, not recurring card checkout.

**Assumption:** card subscriptions are an additional (or later default) path for people who will not pay in USDC/HYPHA. They should map onto the **same space-is-active entitlement**, not invent a second product.

---

## 2. Charging unit options

Hypha’s unit of access is already the **space**. Postgres `memberships` is `(person_id, space_id)` with **no role column**. Delegate vs member is on-chain. Spaces nest via `spaces.parent_id`. Sandbox / demo / archived are flags, not plans.

Illustrative card tiers (not live): Starter $12 / space / month, Team $29, Network $79.

| Model | How it would work here | Pros | Cons |
|---|---|---|---|
| **Per space** (flat or tiered plan) | One subscription SKU per `spaces.id`. Matches `SpacePaymentTracker` and `payForSpaces(spaceIds, amounts)`. Tiers could later map to feature flags (`NEXT_PUBLIC_ENABLE_AI_CHAT`, Coherence, Space Memory) | Fits current gates; one payer activates everyone in the space; dashboard already reports spend **by space** | Large orgs overpay or underpay vs headcount; child spaces each need a line (or a parent pack) |
| **Per user / seat** | Seat = a `memberships` row (per space) or a distinct person across spaces (org-wide). **Assumption:** per-space seats match Hypha better than org-wide — there is no billing org table | Familiar SaaS; scales with members | Membership has no seat/role field; people join many spaces; delegate is not a DB role; guests/observers are undefined |
| **Hybrid** | Space base (activation) + seats, **or** space plan + metered usage | Keeps space as the entitlement unit; seats/usage become add-ons | Two SKUs and two failure modes (base lapses vs seat cap) |
| **Usage-based** | Only where a meter is already obvious (see below) | Aligns cost with expensive AI; optional overage on a space plan | Almost no ledger exists; Matrix/message and on-chain action counts are poor SaaS meters |

### Usage surfaces (what is / is not metered)

| Surface | Meter today? | Charge later? |
|---|---|---|
| **AI chat / images** | OpenRouter usage is on the stream (`stream-chat.ts`) but **not stored** | Yes — best meter. Expired spaces already lose AI signal actions |
| **Space Memory / call media** | ADR 0001: object storage + DB pointers; **no byte ledger** | Maybe, once recordings are counted |
| **Human chat / on-chain txs / banking** | Matrix rooms; users pay gas; Bridge is the space’s money | **No** — social, double-charges governance, or not Hypha SaaS |
| **Proposals / docs / API keys** | Countable rows, not productized as usage | Plan limits only, not a default meter |

**Unknowns:** who owns child-space cost (parent vs each child); whether sandbox/demo spaces stay free; whether Hypha platform spaces (`hypha`, `hypha-platform`) are always comps (they are hidden on the paying-spaces dashboard by default).

---

## 3. Card subscriptions (Stripe or similar)

**Fact:** no payments provider for SaaS exists. Stripe Checkout + Customer Portal + webhooks is a greenfield add (`apps/web` route handlers + `packages/core` server module). Vendor is not mandated by the repo; pick one card-recurring processor. **Do not** route this through Bridge.

### Billable customer

| Candidate | Fit | Recommendation |
|---|---|---|
| **Person who pays** (Privy `people.sub` → Stripe Customer) | Auth already identifies the caller (`PrivyClient.verifyAuthToken`; example `apps/web/src/app/api/matrix/token/route.ts`) | **Payer of record.** Card, receipts, dunning, tax ID sit on the person |
| **Space** | Entitlement unit; `web3SpaceId` is the on-chain key | **Entitlement target**, not the cardholder. A space has no email/KYC for SCA |
| **Network / parent org** | `parent_id` exists; no billing-account table | Phase 2+ if a parent buys a pack for children |

**Assumption:** one Person may sponsor several spaces (already true for `payForSpaces` arrays). Checkout creates/updates a Stripe Customer on that person and a Subscription whose metadata is `spaceId` (+ optional `web3SpaceId`).

### Lifecycle

| Step | Proposed behaviour |
|---|---|
| **Checkout** | Authenticated member or delegate starts Checkout / Portal. Success webhook activates `Subscription` and extends entitlement (§6) |
| **Renewals** | Auto-charge. Processing `invoice.paid` **must be idempotent** on a unique provider invoice or event key (duplicates must not add another invoice or more access days). Invoice lives in Postgres and expiry is on-chain (`SpacePaymentTracker`), so they cannot share one transaction: record the invoice as **pending**, extend expiry via an outbox/reconciliation step (owner / owner-controlled relayer + `setCustomExpiryTime` — see below), store the chain tx hash, and mark the invoice **applied** only after that update is confirmed |
| **Failed payments** | Grace (e.g. 7 days, **assumption**) → dunning via `sendEmailByAlias` (person `slug` = OneSignal `external_id`) → lapse. Mirror lapse so proposals and AI stop together |
| **Plan changes** | Upgrade now + proration; downgrade at period end. Changing space = cancel + new Checkout |
| **Cancellation** | At period end. Badge stays “active until {date}” |
| **Taxes / receipts** | Processor-owned. Store provider IDs plus required billing metadata (invoices and line items per §5); never store payment instrument data (ADR 0002 spirit) |

**Phase 1 authority to extend expiry (fact + assumption).** `updateSpacePayment` is callable only by `HyphaToken` (add-days). `setCustomExpiryTime` is `onlyOwner` and writes an **absolute** timestamp, not added days. Phase 1 backend therefore cannot call `updateSpacePayment`. **Assumption:** the contract owner (or an owner-controlled relayer the owner authorizes to submit txs) is the signer. The backend reads current `expiryTime`, computes the new absolute value itself (if expired or unset: now + period; else current expiry + period), then calls `setCustomExpiryTime`. Without that owner/relayer path, a successful card payment cannot extend an expired space. Idempotency on the provider invoice/event key does not serialize two *different* invoices for the same space: both can read the same `expiryTime` and one paid period is lost. A backend re-read-then-write retry is **not** enough — two txs can still race on-chain. Require either (1) reconciliation for a given `spaceId` runs serially (per-space lock or queue), or (2) an on-chain atomic extend: owner-callable add-days (same semantics as `updateSpacePayment`, but not HyphaToken-only) **or** a real compare-and-set that writes the new expiry only if on-chain `expiryTime` still equals the expected value.

Failed-payment UX should reuse the existing **expired / renew-before** badge and activate CTA (`subscription-badge.tsx`, `sales-banner.tsx`), not a new billing-only chrome in Phase 1.

---

## 4. How one card is divided among members

All options assume **one processor subscription**, then an internal allocation. Membership cannot express “billing admin” today — that is a new flag or “payer = Checkout person”.

| Option | Ledger objects | UX friction |
|---|---|---|
| **A. Single payer** (admin/sponsor pays; members get access) | `Customer` (person), `Subscription` → `space_id`, `Invoice`. No member split | Lowest. Matches “space is active for everyone.” Payer change = new Checkout or Portal customer update |
| **B. Cost-split / recharge** | A + `Allocation` per member per invoice. Equal: `amount / membership_count`. Role-weighted: need a role source (on-chain delegate vs member — **not** in Postgres). Usage-weighted: needs `UsageEvent` | High. Invoices, disputes, leavers mid-cycle, unpaid shares. Needs in-app balance or external request-to-pay. **Not Phase 1** |
| **C. Seat packs** | `Subscription` with `quantity` (seats). `SeatAssignment(space_id, person_id, seat_index)`. Unassigned seats are prepaid slack | Medium. Join flow must assign/refuse when the pack is full. Removing a member frees a seat; does not auto-refund |
| **D. Personal subs → space entitlements** | `Subscription` on person; `EntitlementGrant` listing spaces (or “all memberships”) | High. Overlap when two members both have personal subs in one space; unclear who pays for a space with no subscribed member |

**Recommendation:** Phase 1 = **A**. Phase 2 = **C** if large spaces complain about a flat fee. **B** and **D** only if finance explicitly needs recharge or a consumer “Hypha Pass”.

---

## 5. Accounting: spend by space and by user

Goal: answer three ops questions without a full ERP.

1. **Spend by space over a period** — sum of invoice line amounts allocated to that `space_id` (plus, for continuity, on-chain activation USD already computed in `paying-spaces.ts`).
2. **Spend attributed to a user** — **as payer:** invoices whose `Customer.person_id` matches. **As consumer:** allocations or seat/usage shares on those invoices (zero in Phase 1 single-payer except “they were a member while the space was paid”).
3. **One invoice → members or child spaces** — allocate, then report. Do not rewrite the processor invoice.

### Sketch (logical, not a migration)

```
Customer        person_id, provider, provider_customer_id
Subscription    customer_id, space_id?, quantity, status, current_period_end, provider_subscription_id
Invoice         subscription_id, period, total_minor, currency, provider_invoice_id, paid_at
LineItem        invoice_id, kind (space_base | seat | usage), quantity, amount_minor
UsageEvent      space_id, person_id?, meter (ai_tokens|storage_byte_days|…), quantity, at
Allocation      invoice_id, target_type (space|person), target_id, amount_minor, method
```

Reuse `bank_customers` **shape** (XOR owner, provider ids only) — do not overload that table.

### Example formulas

| Case | Formula |
|---|---|
| Single space, single payer | `Allocation(space) = Invoice.total`; `Allocation(payer) = Invoice.total` as payer; consumers get $0 |
| Parent invoice covering children | Weight by **child-months** (same idea as `allocateUsdByDuration` in `paying-spaces-timeline.ts`). Child *i*: `total * months_i / sum(months)` |
| Equal member split | If membership count is 0, the full amount stays allocated to the space. Otherwise `Allocation(person) = LineItem.amount / count(memberships at period end)` — document the snapshot rule |
| Seat pack | If `purchased_seats` (`Subscription.quantity`) is 0, the full amount stays allocated to the space. Otherwise each assigned seat gets `space_base / purchased_seats`; remainder `space_base * (purchased_seats - assigned_count) / purchased_seats` stays on the space (unused seats, including when `assigned_count` is 0) |
| Usage add-on | `Allocation(person) = usage_line * (person_usage / space_usage)` |

On-chain and card spend should share a **canonical USD number** in the ops dashboard (card: invoice total; chain: existing HYPHA/USDC conversion). Do not double-count if a card charge is later used to `payForSpaces`.

---

## 6. Technical feasibility in this codebase

### Reuse

| Area | Reuse |
|---|---|
| **Auth** | Privy → `people.sub`; Bearer verify already used. Checkout is server-only (`core/server`) |
| **Spaces / members** | `spaces`, `memberships`, `people`; nest via `parent_id`; flags gate AI / chat / Coherence / Memory |
| **Entitlement + dashboard** | Badges, AI, and proposal gates already use `SpacePaymentTracker`; extend paying-spaces for USD |
| **Email** | `sendEmailByAlias` + person `slug` / `email` |
| **Wallet / treasury** | Keep USDC/HYPHA activation. Space tokens (`utility`, `credits`, …) are **not** Hypha SaaS |

### New

- Provider SDK + webhook HMAC (follow `createHmac` middleware used for Alchemy; new file under `packages/core/src/common/server/webhooks/<provider>/`)
- Postgres tables for the sketch in §5 (Drizzle in `storage-postgres`, `{ db }` injection)
- Checkout / portal / webhook API routes
- A **billing admin** signal (membership flag or “payer person id on the space”) — does not exist today
- Seat assignment UX if Phase 2

### On-chain vs off-chain (recommendation)

**Use off-chain cards for recurring SaaS.** Wallets are a poor dunning/SCA/tax path; the repo does not require on-chain for new billing.

Governance still reads **only** `isSpaceActive`. So a card payment that does not extend `SpacePaymentTracker` would leave proposals blocked while AI (if dual-read) stayed up.

**Assumption for Phase 1:** after `invoice.paid`, the owner or owner-controlled relayer calls `setCustomExpiryTime` with a backend-computed **absolute** `expiryTime` (§3). Crypto users keep `payForSpaces` / `payInHypha`. Entitlement stays one boolean: the space is active until a timestamp.

Do not put card state in the contract. Do not use HYPHA as the card settlement asset.

---

## 7. Recommendation

### Phase 1 — per-space card subscription, single payer, spend dashboard

- One card SKU ≈ current activation (illustrative **$11–12 / space / month**, aligned with the 11 USDC figure — **not** a price decision).
- Payer = authenticated person; **one space per subscription** (one Checkout → one `Subscription.space_id`). A person who sponsors several spaces starts a Checkout per space.
- Webhook extends `SpacePaymentTracker` so proposal gates and badges stay consistent.
- Ops: paying-spaces dashboard gains a **card vs on-chain** split and payer person.
- Failed pay / cancel: existing expired/renew banner + email.

### Phase 2 — seat packs (if flat-fee complaints)

- Quantity on the same space subscription; assign seats to `memberships`.
- Soft cap on join (waitlist or “ask payer to add seats”).
- Still one invoice; allocations optional for reporting only.

### Phase 3 — usage meters + consumer attribution

- Persist OpenRouter usage as `UsageEvent` (space + person).
- Included AI quota on the space plan; overage line or hard stop.
- Optionally storage byte-days once media rows are reliable.
- Report payer spend vs consumer share; still no in-app recharge unless finance asks.

### Open questions (product)

1. Is card a **second rail** beside USDC/HYPHA, or does it replace activation for non-crypto orgs?
2. Are child spaces billed separately or as a parent pack?
3. Who may start Checkout — any member, delegates only, or a new billing-admin flag?
4. Free forever for `sandbox` / `demo` / Hypha platform slugs?
5. Grace period length and whether lapsed spaces stay readable (chat/docs) while proposals/AI lock.
6. VAT/sales-tax residency: person address vs space jurisdiction?
7. Do we ever need member recharge (option B), or is sponsor-pays enough?

---

## 8. Out of scope

Replacing Bridge banking, changing tokenomics, new UI in this PR, live price lists, and any contract deploy. Next implementation ticket should be a short spec for Phase 1 only (Checkout, webhook, entitlement mirror, dashboard columns).
