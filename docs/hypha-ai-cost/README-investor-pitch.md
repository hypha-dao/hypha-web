# HYPHA Tokenomics — Investor Pitch Guide

> **Who this is for:** Hypha team members talking to investors.  
> **Goal:** Explain our token model in plain language in 5–10 minutes.  
> **Live tools:** [Phase I simulator](https://app.hypha.earth/tokenomics1/) · [Phase II simulator](https://app.hypha.earth/tokenomics2/)

---

## The roadmap: Phase 0 → Phase I → Phase II

| Phase | When | What happens | Key numbers |
|---|---|---|---|
| **Phase 0** | **Today** | ~4,373 Spaces live on Hypha. Tokenomics Phase I has not started (month 0). | Reference FDV ~**$111M** at **$0.20** (111M locked supply) |
| **Phase I** | **Month 0+** | Fixed **$0.20** token price. Token sale, locking, and yield distribution over ~12 months. | Default sim: 50 → ~**4,325** active Spaces by month 12 |
| **Phase II** | **After Phase I** | **$44/Space/mo** gross revenue. **Dynamic IEX price** from usage + liquidity. 48-month growth scenarios. | Starts ~**4,373** paying Spaces; scenarios to year 4 below |

**Pitch order:** Phase 0 (where we are) → Phase I sim (bootstrap) → Phase II sim (scale scenarios).

---

## The one-sentence pitch

**Hypha is a network of autonomous organizations (“Spaces”) that pay recurring revenue into the protocol; HYPHA captures value as the network scales, with token economics tied to real usage—not speculation alone.**

---

## Start here: what is a “Space”?

A **Space** is one organization on Hypha (a DAO, community, or team). Think of it like one customer account on a SaaS platform.

**~4,373 Spaces are active today (Phase 0).** Phase II scenarios model what happens over the **four years after Phase I**, using cumulative adoption milestones of **250k, 1M, or 10M Space-months**.

**Critical distinction — who is paying each month:**

- **Cumulative Space-months (250k / 1M / 10M)** = sum of active Spaces counted **each month** over 48 months (adoption milestone).
- **Active Spaces at year 4** = organizations **paying that month** (~6k / ~58k / ~1.1M).
- **ARR** = active Spaces at month 48 × **$44 × 12** (run-rate, not cumulative).

Only **active Spaces in a given month** pay that month’s $44. Cumulative totals are **not** “1M organizations paying at once.”

---

## Where the money comes from

Each **active** Space contributes **$44 USDC per month** in gross revenue to the Hypha network (Phase II onward).

That number is the anchor for all three scenarios. Operating costs (AI inference and blockchain gas) are modeled separately and are **much smaller** than $44 per Space at typical usage on open-weight inference (~$4/Space/mo AI in the sim default; up to ~$17 on Composer-class stack).

**Revenue allocation (Phase II):**

| Share | Use |
|---:|---|
| **25%** (Low/Mid) or **19%** (High) | IEX buy pressure — supports HYPHA on the exchange |
| **75% / 81%** | AI inference, gas, operations, off-pool rewards, treasury |

**Month-48 run-rate ARR (who is paying in the final month):**

| Active Spaces (month 48) | Paying monthly | Annual revenue (ARR) |
|---:|---:|---:|
| ~6,000 | ~$270k/mo | **~$3M** |
| ~58,000 | ~$2.5M/mo | **~$30M** |
| ~1,100,000 | ~$49M/mo | **~$590M** |

**Total gross billed over 4 years** (all months): Low ~$11M · Mid ~$44M · High ~$440M (cumulative Space-months × $44).

Lead with: *“At year four, ~6k to ~1.1M Spaces pay each month — that’s the $3M to $590M run-rate. Cumulative adoption tells us how we got there.”*

---

## What HYPHA token does

HYPHA is the network token. In the model:

1. **Spaces pay in USDC** → a fixed share supports the token via the **IEX** (the protocol’s exchange pool).
2. **The rest runs the platform** — AI, gas, ops, rewards, treasury (see 75% above).
3. **Token holders** participate through staking, rewards, and network growth.

**Say it simply:** *“Usage drives USDC into the network; ~20–25% supports HYPHA on the exchange; the rest runs the platform.”*

---

## Three scenarios (Low / Mid / High) — Phase II

Use the **Phase II simulator** sidebar. Each is a four-year story **after Phase I handoff**.

| Scenario | Cumulative (4yr) | **Active & paying (M48)** | ARR (M48) | FDV (indicative) | Token price |
|---|---:|---:|---:|---:|---:|
| **Low** | ~250k | **~6k** | ~$3M | **~$1.5B** | **~$2.75** |
| **Mid** | ~1M | **~58k** | ~$30M | **~$4B** | **~$7** |
| **High** | ~10M | **~1.1M** | ~$590M | **~$31B** | **~$57** |

FDV is **fully diluted** (555M HYPHA). Low/Mid FDV reflects **network optionality + Phase I anchor** while run-rate ARR is still ramping — not a strict 12-month revenue multiple. High is closer to large-network comps but still optimistic (~50× run-rate ARR).

**Important framing:** Scenario models, not forecasts.

---

## How to walk an investor through the simulators

### Option A — Full story (~8 min)

1. **Phase 0:** ~4,373 Spaces today, ~$111M reference FDV at $0.20.
2. Open [tokenomics1](https://app.hypha.earth/tokenomics1/) — Phase I fixed price, growth to ~4,325 Spaces by month 12.
3. Open [tokenomics2](https://app.hypha.earth/tokenomics2/) — handoff at ~4,373 Spaces, **$44/Space**, dynamic IEX.
4. Click **Low** → **Cumulative Spaces** (~250k), **Active (month 48)** (~6k paying), **ARR**, **FDV/ARR**, **FDV**.
5. Click **Mid**, then **High**.

### Option B — Quick demo (Phase II only, ~5 min)

1. Open [tokenomics2](https://app.hypha.earth/tokenomics2/)
2. **$44/Space** · **25% to IEX** · **75% off-pool**
3. Show **Active (month 48)** before citing cumulative totals
4. Show **FDV/ARR** — explain Low/Mid are ramp narratives

---

## Answers to common investor questions

**“Is $44 per Space realistic?”**  
Working assumption for protocol value capture (AI + governance + treasury). Stress-test in the simulator.

**“Why doesn’t 100% of revenue buy the token?”**  
**19–25%** to IEX is deliberate value accrual; **75–81%** funds AI (~$4/Space on open models), gas, ops, and treasury.

**“What does 250k Spaces mean if only ~6k pay at year 4?”**  
**250k = cumulative Space-months** over four years. **~6k pay each month** in year 4 → **~$3M ARR**. Always state **active payers + ARR** when citing scenario labels.

**“How does Phase I connect to Phase II?”**  
Phase I bootstraps at fixed **$0.20** (~$111M FDV). Phase II starts ~4,373 paying Spaces; price emerges from IEX. Low scenario FDV (~$1.5B) is ~14× Phase I reference — reflects network growth narrative, not 6k × revenue alone.

**“How does this compare to other tokens?”**  
High scenario: large-network band (Maker, Uniswap). Low/Mid: early-stage / ramp comps (Bittensor, Helium) — not Maker 10–15× on year-4 ARR alone.

**“Is this financial advice?”**  
No. Internal planning tool. Past comps don’t guarantee future pricing.

---

## Suggested 60-second script

> “We’re at **Phase 0** — **~4,400 Spaces** on Hypha, **~$111M** reference valuation. **Phase I** launches tokenomics at fixed **$0.20**. **Phase II** adds **$44/month per Space** and dynamic exchange pricing.  
>  
> Over four years after handoff, cumulative adoption could reach **250k to 10M Space-months** — meaning **~6k to ~1.1M Spaces paying each month** at year four, **$3M to $590M run-rate ARR**. **~25%** of gross supports HYPHA on IEX; the rest runs the platform. Models imply **~$1.5B to ~$31B fully diluted** depending on scenario.  
>  
> Click through both simulators and stress-test the assumptions.”

---

## Cheat sheet

| | Low | Mid | High |
|---|---:|---:|---:|
| **Cumulative Space-months** | ~250k | ~1M | ~10M |
| **Active & paying (M48)** | **~6k** | **~58k** | **~1.1M** |
| **ARR (M48 run-rate)** | ~$3M | ~$30M | ~$590M |
| **4yr total gross billed** | ~$11M | ~$44M | ~$440M |
| **FDV (indicative)** | ~$1.5B | ~$4B | ~$31B |
| **IEX routing** | 25% | 25% | 19% |

---

## Where to go deeper

- **Technical cost model (AI + gas per Space):** [README.md](./README.md)
- **Scenario parameters and comps:** [README.md — Tokenomics simulator assumptions](./README.md#tokenomics-simulator-scenario-assumptions-phase-ii)

