# Hypha AI — Estimated AI Cost per Space

> Cost model for running Hypha AI features against an LLM, expressed as **average
> spend per Space**. Headline numbers use **Cursor Composer 2.5 Fast**; a dedicated
> section estimates the same workload on the **most capable open-source models**.
>
> _Last updated: June 2026. Token volumes are grounded in the current
> `packages/chat-server` implementation; pricing is sourced from public rate cards
> (see [Sources](#sources))._

---

## TL;DR

| Space profile | Members | AI cost / month (full vision) | Live-today only | AI tasks / month |
|---|---|--:|--:|--:|
| Light | ~5 | **$5.48** | $2.45 | 112 |
| **Typical** | **~15** | **$16.52** | **$10.13** | **319** |
| Heavy | ~50 | **$45.06** | $31.26 | 840 |

- **One-time onboarding** (per Space, ~12-turn guided setup): **~$0.56**.
- The **typical active Space costs ≈ $16.50/month (≈ $198/year)** on Composer 2.5 Fast.
- Swapping the model out for a **top open-source model cuts this 3×–24×** — see
  [Open-source model pricing](#open-source-model-pricing). The cheapest credible
  option (DeepSeek V4-Flash) lands the typical Space at **~$0.70/month**.

---

## What "scope" means

Only the **chat copilot** makes model calls in the build today. The **Signal
Orchestrator, discussion summaries, and call summaries are heuristic** (template/
word-overlap scoring — **zero LLM tokens**). They cost nothing until their Phase 3
AI versions ship.

- **Live today** — bills only the copilot (Q&A, advisory, memory deep-dive, signal
  authoring, web search, discovery).
- **Full AI vision** — bills *every* AI-augmented surface to the model, including the
  background features that are heuristic today. This is the cost **ceiling**.

---

## Pricing basis — Composer 2.5 Fast

| Tier | Input $/1M | Output $/1M | Notes |
|---|--:|--:|---|
| **Composer 2.5 Fast** | **$3.00** | **$15.00** | IDE default; high throughput. **Headline number.** |
| Composer 2.5 Standard | $0.50 | $2.50 | Same model & intelligence, lower throughput (6× cheaper). |

Composer runs **inside Cursor only** — there is no public API or third-party gateway.
For a platform like Hypha (which calls models server-side via OpenRouter), Composer
is therefore a **reference price point**, not a directly deployable backend. It is the
basis the estimate was requested against.

---

## Methodology & assumptions

Token sizes are read from `packages/chat-server`:

- **In-space system prompt ≈ 5.6k tokens**, re-sent on every step.
- **Tool loop capped at 6 steps** (`stepCountIs(6)`); full conversation history is
  re-sent each step (no truncation).
- **No `max_tokens` cap** is configured → output sizes below are conservative
  per-reply estimates.
- **Org-memory asset reads capped at 48k chars** (~12k tokens) per `fetch_org_memory_asset`;
  PDFs/images push deep-dive turns to the high end.
- **Orchestrator** capped at 3 auto-signals/day/space with cooldowns; discussion
  refresh modeled at ~4 runs/day.
- Task volumes for "Typical" assume ~15 members with a handful of AI-active users.
  Light ≈ 0.33× and Heavy ≈ 2.73× the typical volume (costs scale ~linearly).

Cost per task = `input_tokens × $3/1M + output_tokens × $15/1M`.

**Hosting is already included.** All rates in this report are **managed / hosted
inference** (per-token) — the provider runs the model on their GPUs and bills per
token (Cursor for Composer; OpenRouter / DeepSeek / DeepInfra for the open models).
There is no separate GPU/infra line to add. Self-hosting the open weights is a
different, fixed-cost model (e.g. one H100 ≈ $1,400+/month) that is **more** expensive
at per-Space volumes and only becomes economic when many Spaces share GPUs — so it is
intentionally out of scope for a per-Space estimate.

---

## Per-feature breakdown — Typical Space (Composer 2.5 Fast, full vision)

| Feature | Surface | Status | Tasks/mo | In tok | Out tok | Cost/task | Monthly |
|---|---|---|--:|--:|--:|--:|--:|
| Discussion summary (background refresh) | Space Memory | Heuristic today | 120 | 12k | 400 | $0.042 | **$5.04** |
| Advisory (multi-tool reads) | Copilot | Live | 40 | 28k | 900 | $0.098 | **$3.90** |
| Q&A & navigation | Copilot | Live | 80 | 9k | 400 | $0.033 | **$2.64** |
| Memory deep-dive (read file/PDF) | Space Memory | Live | 12 | 45k | 1.2k | $0.153 | **$1.84** |
| Signal Orchestrator (auto signal) | Signals | Heuristic today | 30 | 10k | 600 | $0.039 | **$1.17** |
| Signal authoring (member, gated) | Signals | Live | 8 | 30k | 1k | $0.105 | **$0.84** |
| Web search assist | Copilot | Live | 15 | 12k | 500 | $0.044 | **$0.65** |
| Network discovery (search spaces) | Discovery | Live | 8 | 9k | 400 | $0.033 | **$0.26** |
| Call transcript summary (per call) | Space Memory | Heuristic today | 6 | 8k | 400 | $0.030 | **$0.18** |
| **Total** | | | **319** | | | | **$16.52** |

**Where the money goes:** background **Space Memory summaries (~31%)** and **copilot
advisory reads (~24%)** dominate. The most expensive *per-task* feature is the
**memory deep-dive** ($0.15/task) because reading a document loads ~12k tokens into
context.

Monthly volume drives total tokens of **≈ 4.66M input + 0.17M output** for the
typical Space — input-heavy, which matters a lot for model selection below.

---

## Cost across Space sizes (full AI vision, Composer 2.5 Fast)

| Profile | Monthly | Annualized | AI tasks/mo |
|---|--:|--:|--:|
| Light (~5 members) | $5.48 | $65.76 | 112 |
| Typical (~15 members) | $16.52 | $198.24 | 319 |
| Heavy (~50 members) | $45.06 | $540.72 | 840 |

---

## Open-source model pricing

The same workload on the **most capable open-source (open-weight) models** of 2026.
This is highly relevant: **Composer 2.5 is itself post-trained from Moonshot's Kimi
K2.5**, so running the open Kimi line directly is the closest like-for-like swap — and
costs a fraction of Composer Fast's interactive premium.

### Representative rates (per 1M tokens)

| Model | Open weights | Input $/1M | Output $/1M | Why it's here |
|---|---|--:|--:|---|
| **Kimi K2.6** (Moonshot) | Yes | $0.95 | $4.00 | Leads open-source quality rankings; agentic; same lineage as Composer. (OpenRouter as low as $0.68 / $3.41.) |
| **DeepSeek V4-Pro** | Yes (MIT) | $0.44 | $0.87 | Flagship open reasoning/coding model; first-party API. |
| **Qwen3.5-397B** (Alibaba) | Yes | $0.60 | $3.60 | Strong open frontier MoE. |
| **Llama 4 Maverick** (Meta) | Yes | $0.50 | $2.15 | 400B MoE; DeepInfra-hosted rate. |
| **DeepSeek V4-Flash** | Yes (MIT) | $0.14 | $0.28 | Budget leader; near-frontier at a fraction of the cost. |
| _Composer 2.5 Fast (baseline)_ | No | $3.00 | $15.00 | _Reference._ |

### Estimated cost — Typical Space (full AI vision)

Applying each model's rate to the typical Space's **4.66M input + 0.17M output
tokens/month**:

| Model | Monthly / Space | Annualized | One-time onboarding | vs Composer Fast |
|---|--:|--:|--:|--:|
| Composer 2.5 Fast _(baseline)_ | $16.52 | $198.24 | $0.56 | — |
| Composer 2.5 Standard | $2.75 | $33.05 | $0.09 | **6.0× cheaper** |
| Kimi K2.6 (list) | $5.11 | $61.26 | $0.17 | **3.2× cheaper** |
| Kimi K2.6 (OpenRouter low) | $3.75 | $44.96 | $0.13 | **4.4× cheaper** |
| Qwen3.5-397B | $3.41 | $40.87 | $0.12 | **4.8× cheaper** |
| Llama 4 Maverick | $2.69 | $32.33 | $0.09 | **6.1× cheaper** |
| DeepSeek V4-Pro | $2.17 | $26.10 | $0.07 | **7.6× cheaper** |
| **DeepSeek V4-Flash** | **$0.70** | **$8.40** | **$0.02** | **23.6× cheaper** |

> Scale to other profiles by multiplying: **Light ≈ 0.33×**, **Heavy ≈ 2.73×** the
> monthly figure above. E.g. a Heavy Space on Kimi K2.6 ≈ $13.9/month; on DeepSeek
> V4-Flash ≈ $1.9/month.

### Takeaways

- **The workload is input-heavy** (≈ 96% of tokens are input — large system prompt +
  re-sent history + tool results). Output price barely moves the total, so models with
  **cheap input** (DeepSeek) win disproportionately.
- **Kimi K2.6** is the natural "same quality, own the stack" choice given Composer's
  Kimi lineage, at **~3× lower** cost than Composer Fast.
- **DeepSeek V4-Flash** makes the AI layer **almost free per Space** (~$0.70/mo), a
  strong default for background features (orchestrator, summaries) where latency and
  peak reasoning matter least.
- A **tiered routing** strategy — premium model for interactive copilot, DeepSeek
  Flash / Composer Standard for background jobs — likely lands a typical Space at
  **$1–3/month** with no perceptible quality loss on the heuristic-replacing features.

---

## On-chain (gas) cost per Space — Base

Governance, treasury and membership settle on **Base**. Gas units below are from **verified Base mainnet receipts** in `packages/storage-evm/scripts/base-mainnet-contracts-scripts/gas-cost-analysis-results.json` (Aug 2025), re-priced at **0.005 Gwei** and **ETH $1,748** (June 2026). Unmeasured operations are labeled and excluded from verified totals.

### Two vote types — most votes do not execute

In Hypha, a passing proposal **auto-executes on the deciding vote** — there is no separate execution transaction.

- **Non-executing vote:** a member casts yes/no while the proposal is still open. Records voting power but **does not run the agreement** on-chain.
- **Deciding vote:** the vote that reaches quorum/unity and **auto-executes** the proposal via the Executor (447k gas verified for a mint-scale agreement — execution bundled in this tx; 2.5M when the vote also deploys a token).

Every proposal has exactly **1 deciding vote** and typically **many more non-executing votes**. Do not add a separate "execution" line on top of deciding-vote gas.

### Verified measurements

| Operation | When | Status | Gas units | Cost (USD) | Tx / note |
|---|---|---|--:|--:|---|
| Vote + auto-execute (token deploy) | Setup | Verified | 2,549,025 | $0.0223 | `0x1f7ed7f4…` |
| Space creation | Setup | Verified | 960,285 | $0.0084 | `0xb6b98a19…` |
| Proposal creation (token deploy) | Setup | Verified | 527,418 | $0.0046 | `0x64e3d917…` |
| Vote + auto-execute (token mint) | Recurring | Verified | 446,949 | $0.0039 | `0x3f0d5487…` · deciding vote incl. execution |
| Proposal creation (token mint) | Recurring | Verified | 378,389 | $0.0033 | `0xab9a53ae…` · typical agreement proposal |
| USDC transfer (ERC-20) | Recurring | Verified | 62,135 | $0.0005 | `0x80e51f14…` |
| Member join | Recurring | **Estimated** | 100,000 | $0.0009 | tx failed in analysis run |
| Non-executing vote | Recurring | **Assumed 150k** | 150,000 | $0.0013 | not yet verified on mainnet |

**Verified one-time setup** (create + deploy-token proposal + deciding deploy vote): **4,036,728 gas → $0.035**.

**Verified recurring proposal** (mint-scale agreement): 378,389 create + 446,949 deciding vote = **825,338 gas → $0.0072** per proposal, before non-executing member votes.

### Recurring gas by Space size

Assumes **active governance** with high member participation. Per proposal: 1× verified create + 1× verified deciding vote (includes execution) + **(N−1) non-executing votes at 150k gas each** ($0.0013/vote).

| Profile | Proposals/mo | Deciding votes | Non-exec votes | Ratio | Treasury/mo | Verified portion | Monthly total |
|---|--:|--:|--:|--:|--:|--:|--:|
| Light (~5) | 5 | 5 | 20 | 4:1 | 3 | $0.038 | $0.06 |
| **Typical (~15)** | **15** | **15** | **195** | **13:1** | **12** | **$0.12** | **$0.37** |
| Heavy (~50) | 50 | 50 | 2,200 | 44:1 | 50 | $0.39 | $3.27 |

**Vote participation:** Typical ≈ 14 of 15 members vote per proposal (1 deciding + 13 non-exec). Monthly total = verified portion + (non-exec votes × 150k gas). Non-executing votes contribute ~69% of Typical monthly gas ($0.26 of $0.37).

### Gas vs AI

With active governance, a Typical space pays **$0.37/month** on-chain vs **$16.52/month** for AI (Composer 2.5 Fast) — roughly **45× less**. Only Heavy scale (~$3.27/mo) approaches meaningful on-chain spend.

**Caveats:** L2 execution gas only; Base adds a small L1 data fee per tx. Gas scales linearly with gas price. Re-run `gas-cost-analysis.ts` on Base to capture a non-executing vote and a successful join.

---

## Levers to reduce cost (any model)

1. **Trim the system prompt / cache it.** It's ~5.6k tokens re-sent every step. Prompt
   caching (60–80% cheaper on cached reads on most open hosts) attacks the single
   biggest line item.
2. **Truncate conversation history** instead of re-sending the full transcript per step.
3. **Route background work to a cheap/standard tier** — orchestrator and summaries
   don't need interactive latency or frontier reasoning.
4. **Set a `max_tokens` cap** to bound output (currently uncapped).
5. **Cap memory deep-dive context** below 48k chars for routine summarization.

---

## Tokenomics simulator scenario assumptions (Phase II)

Interactive simulators: [`tokenomics-simulator.html`](tokenomics-simulator.html) (Phase II) and [`tokenomics-simulator-phase1.html`](tokenomics-simulator-phase1.html) (Phase I). Deployed at `/tokenomics2` and `/tokenomics1` on the web app.

**Investor-facing summary:** [README-investor-pitch.md](./README-investor-pitch.md)

### Roadmap: Phase 0 → Phase I → Phase II

| Phase | When | Simulator | Key state |
|---|---|---|---|
| **Phase 0** | Today | — | Pre-launch. Reference FDV ~$111M at $0.20 (111M locked supply). |
| **Phase I** | Year 1 (months 0–12) | Phase I (`/tokenomics1`) | Fixed $0.20. **Bootstrap ~0 → ~4,373** paying Spaces (50-Space seed at 50%/mo). |
| **Phase II** | Years 2–5 (48 months) | Phase II (`/tokenomics2`) | Starts **~4,373** paying Spaces. $44/Space/mo. Year-5 paying / created: Low ~15k/250k · Mid ~50k/1M · High ~500k/10M. |

Phase II month 1 = first month after Phase I (~4,373 active Spaces). Year 5 = Phase II month 48.

### Fixed inputs

| Parameter | Value |
|---|---|
| Gross revenue per Space (Phase II) | **$44 USDC / month** |
| Simulation horizon (Phase II) | 48 months |
| Total HYPHA supply | 555,555,555 |
| Phase I reference price | **$0.20** (fixed; ~$111M FDV) |

### Revenue allocation (Phase II)

| Share | Destination |
|---:|---|
| **19–25%** (by scenario) | IEX buy pressure |
| **75–81%** | AI inference, gas, operations, off-pool rewards, treasury |

Simulator default AI cost uses **open-weight inference (~$4/Space/mo typical)**; Composer Fast reference is **~$16.50/Space/mo** — see [TL;DR](#tldr) above.

### Growth scenarios

Each preset tracks **two series**, both starting from the ~4,373 Phase I handoff and growing from month 2 onward:

- **Active (paying) Spaces** — pay $44/mo and drive all revenue (growth rate `active`).
- **Cumulative Spaces created** — the full funnel (free + paid; growth rate `created`). Active payers are the **~5–6%** of created Spaces that pay at year 5.

| Scenario | Year-5 active (paying) | Year-5 created (cumulative) | Paying rate | Active growth / mo | Created growth / mo | IEX routing % |
|---|---:|---:|---:|---:|---:|---:|
| **Low** | ~15k | ~250k | ~6% | 2.66% | 8.99% | 25% |
| **Mid** | ~50k | ~1M | ~5% | 5.32% | 12.25% | 22% |
| **High** | ~500k | ~10M | ~5% | 10.61% | 17.89% | 19% |

**ARR** uses **active (paying) Spaces at year 5** × $44 × 12: Low ~$7.9M · Mid ~$26M · High ~$264M.

**Phase II gross billed** (sum of active Spaces × $44 across 48 months): Low ~$18M · Mid ~$40M · High ~$228M.

Only the **IEX routing %** of gross Space contributions enters the on-chain AMM buy path. Investor buy/sell pressure on IEX defaults to **4–8% buy** and **4–5% sell** (pool-relative, not dollar-matched).

**Key metrics to show investors:** **active payers at year 5** · cumulative created · run-rate ARR · FDV · **FDV/ARR**.

### Target valuation bands (year 5, judgment + comps)

Run-rate ARR at year 5: Low ~$7.9M · Mid ~$26M · High ~$264M. FDV multiples descend as the network matures — High lands near ~30× ARR (growth-stage comps); Low/Mid carry higher multiples as early-network optionality while revenue ramps.

| Comp | Rough FDV | Revenue / fees | Implied multiple |
|---|---:|---:|---:|
| MakerDAO | ~$1–2B | ~$100–200M/yr | ~10–15× |
| Uniswap | ~$5–15B | ~$500M–1B/yr | ~10–20× |
| Helium (peak) | ~$1.2B | low on-chain revenue | growth narrative |
| Bittensor | ~$3–4B | early / low | high narrative multiple |

**Target FDV / FDV-to-ARR** after calibration (sim-verified):

| Scenario | Target FDV | FDV/ARR | Token price (indicative) |
|---|---:|---:|---:|
| Low | ~$0.4B | ~51× (early ramp) | ~$0.72 |
| Mid | ~$1.0B | ~38× | ~$1.82 |
| High | ~$8.1B | ~31× | ~$14.50 |

IEX seed liquidity scales with scenario (`initialHypha` / `initialUsdc` anchor starting price at $0.20): Low 25M HYPHA / $5M USDC, Mid 35M / $7M, High 63M / $12.6M. Parameters were tuned so emergent IEX price × max supply lands in these bands — not by fixing an end-state price directly.

---

## Sources

- Composer 2.5 pricing: Cursor (Fast $3/$15, Standard $0.50/$2.50; Composer is
  post-trained from Kimi K2.5).
- Open-source rates: OpenRouter, DeepSeek first-party, and public LLM price
  comparators (June 2026). Open-weight rates vary by host — verify on the live
  provider dashboard before committing.
- Token volumes & feature inventory: `packages/chat-server` (system prompt, 6-step
  tool loop), `packages/core/src/coherence/server/signal-orchestrator.ts`,
  `packages/core/src/governance/server/call-artifacts.ts`.
- Gas measurements: `packages/storage-evm/scripts/base-mainnet-contracts-scripts/gas-cost-analysis-results.json`
  (Base mainnet, Aug 2025).

> An interactive version of this model (toggle Space profile and scope) is also
> available as a Cursor canvas: `hypha-ai-cost-per-space.canvas.tsx`.
