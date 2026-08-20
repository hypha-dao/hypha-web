---
title: 'User Journeys — The Intelligent Organization'
date: 2026-08-20
status: draft
tags: [product, journeys, intelligent-org, ai]
---

# User Journeys — The Intelligent Organization

**This document describes the target state**: how we intend people to use Hypha once the
intelligent organization works, not how the product behaves today. It is the product brief that
the [Organizational Intelligence architecture](../architecture/organizational-intelligence.md)
exists to serve. Written for the whole team — no code required.

---

## The promise, in one sentence

> Anyone in a Hypha organization opens the app and immediately knows what matters and what to do
> next — because the organization remembers, and the AI keeps that memory active.

Everything below is a way of delivering that sentence to a specific kind of person on a specific
kind of day.

---

## Three rules that make a journey feel intelligent

These are the tests we apply to every screen and every interaction. If a journey breaks one of
them, it isn't an intelligent-organization journey — it's just software with a chat box.

1. **Nobody starts from a blank page.** Whatever you are about to write — a proposal, a summary, a
   plan, an onboarding note — the organization's memory has already drafted a first version, and
   your job is to correct it rather than produce it.
2. **Nobody has to ask what changed.** The organization tells you, unprompted, in a form short
   enough to read in thirty seconds. You should never have to go hunting to find out you were
   needed.
3. **Nothing the organization learns is lost.** Every decision, and every recommendation you
   accepted or rejected, leaves a trace that shapes what the AI says next month. The org gets
   sharper with use.

---

## The trust ladder

The AI does not arrive with full autonomy. It climbs. Each rung must be earned by demonstrated
accuracy at the rung below, and we should be able to say out loud which rung we are on for any
given space.

| Rung         | The AI...                                         | Human role         |
| ------------ | ------------------------------------------------- | ------------------ |
| 1. Observe   | records and organizes what happened               | reads              |
| 2. Brief     | explains what changed and what it means           | reads, corrects    |
| 3. Recommend | names an owner and a next action, with evidence   | accepts or rejects |
| 4. Draft     | writes the proposal, memo, or memory update       | edits and approves |
| 5. Propose   | files it into the real workflow, pending approval | approves           |
| — Decide     | **never**                                         | always human       |

The last row is a product commitment, not a technical limitation. Money, membership, and
governance outcomes are decided by people. This is what makes the memory trustworthy enough to be
worth having.

One nuance about rung 5. Filing something into the workflow includes choosing _which_ workflow —
whether this needs one owner's nod, a quiet objection window, or a full vote. Routing well is more
valuable than drafting well, and the AI's bias must always run toward the lightest channel that
fits, never toward the vote. See [Journey 5](#journey-5--the-organization-decides-and-then-learns).

---

## Stakeholders

Two things to hold before reading the list.

**These are roles, not people.** In a five-person organization, one person is plausibly founder,
steward, coordinator _and_ beneficiary at once. The taxonomy answers "what does this person need
right now", not "what is their job title". Someone can move between rings, and most people do.

**What someone stakes should determine their authority over memory.** This is the organizing
principle. A person who stakes their time and judgment gets to change what the organization
believes. A person who stakes capital gets to see honestly and to be heard — but not to direct. A
person who stakes nothing yet gets to read what the organization chooses to publish. Getting this
mapping wrong in either direction is how organizations either capture themselves or lose trust.

### Ring 1 — Inside: members who hold decision rights

They stake time and judgment. They read memory freely, propose changes to it, and vote.

- **Founder / initiator** — defines purpose and initial structure. A deliberately temporary role
  that should dissolve into the others.
- **Contributor** — does the work and holds a vote. The majority.
- **Steward** — accountable for a domain; holds a mandate and a budget envelope; approves at Tier 1.
- **Coordinator** — keeps rhythms, onboarding, and memory hygiene running. Custodian of the corpus.

### Ring 2 — The committed edge: a formal stake, no operational vote

They stake capital, dependency, or reputation. They see a curated view and can file observations.
They do not direct operations.

- **Investor / funder** — capital at risk.
- **Beneficiary** — the people the organization exists to serve.
- **Partner organization** — a peer or parent space with its own membership.

### Ring 3 — Outside: no formal stake yet

They stake attention.

- **Prospective member** — evaluating whether to join.
- **Builder / integrator** — extending the platform with their own tool.
- **Verifier / auditor** — checking one specific claim.

### The mapping

| Stakeholder     | Stakes                | Memory access                                 | Decision rights                          | Journey |
| --------------- | --------------------- | --------------------------------------------- | ---------------------------------------- | ------- |
| Founder         | purpose, reputation   | writes the seed corpus                        | all tiers                                | 1       |
| Contributor     | time, judgment        | reads all; proposes changes                   | votes at Tier 3                          | 2, 3    |
| Steward         | domain accountability | approves changes in their domain              | approves Tier 1 inside their mandate     | 4       |
| Coordinator     | the org's coherence   | curates and consolidates                      | routes and schedules; no extra authority | 4, 5    |
| Investor/funder | capital               | curated view, including unsettled arguments   | consent on reserved matters only         | 6       |
| Beneficiary     | dependency on outcome | published subset; contributes outcome reports | none; files observations                 | 7       |
| Partner org     | joint commitments     | artifacts relayed to them                     | decides for itself                       | 8       |
| Prospective     | attention             | the public brief                              | none                                     | 2       |
| Builder         | effort, reputation    | writes via app identity; proposes only        | none                                     | 9       |
| Verifier        | their own assurance   | specified claims plus on-chain proof          | none                                     | 6       |

Journeys 1–5 sit inside the organization, 6–7 at the committed edge, 8–9 outside it.

---

## Journey 1 — The founder starts an organization

**Who:** someone with a purpose and no structure yet.
**Wants:** to go from an idea to a real organization others can join, without learning governance
theory first.

1. They describe what they're trying to do, in their own words, in conversation.
2. The AI interviews them — not a form. It asks what the organization is for, who it serves, what
   it will not do, and how they will know it's working. It draws on patterns from comparable
   organizations in the network to ask sharper questions.
3. It proposes a structure: the space, sensible entry and decision methods, a first set of roles.
   The founder edits rather than invents.
4. **The conversation becomes the organization's first memory.** The purpose, the boundaries, and
   the success signals are written as the founding artifacts — not buried in a chat log.
5. The founder is shown what was recorded and asked to confirm it. This is the first approval.

**What memory does:** this journey _creates_ the seed corpus. Nothing else works well without it.
**Why it feels intelligent:** the founder never sees an empty form, and the organization can
already answer "what are we for?" on day one.
**How we know it works:** the founding artifacts are still being cited and revised six months
later, instead of abandoned.

---

## Journey 2 — Joining: from prospect to contributor

**Who:** a prospective member evaluating an organization, and then the same person once inside.
**Wants:** first, to judge whether this is worth joining. Then, to become useful quickly without
reading a year of chat.

1. **Before joining**, they read the organization's public brief — what it is for, how it decides,
   what it has actually done. Generated from memory, so it is current rather than a stale landing
   page, and honest about what is unresolved. Deciding _not_ to join on good information is a
   successful outcome of this step.
2. On arrival they get a briefing generated from the organization's memory: what this org believes
   it is for, what it has decided, what is currently open, and what is contested.
3. They can ask follow-ups in plain language — "why did we choose this voting method?" — and get an
   answer that cites the actual decision, with its date and reasoning.
4. The AI proposes where this person plausibly fits, based on the stated skills and the
   organization's open needs.
5. Their first contribution is scoped for them: one specific, small, real thing.

**What memory does:** this is the clearest proof that memory has value. Onboarding a human — and
persuading a prospect — is mostly reading organizational memory aloud.
**Why it feels intelligent:** the org explains itself, including its unresolved arguments, rather
than handing over a document dump.
**How we know it works:** time from joining to first meaningful contribution drops sharply, and
new members stop asking questions that are already answered in memory.

---

## Journey 3 — A contributor's week (the core loop)

**Who:** an active member with limited attention and a real job.
**Wants:** to not miss the thing that needed them.

1. **Once per period, they receive a digest** — not a notification per event. It says what changed
   in the organization, what it means, and what needs them specifically.
2. Each item names _them_, states one concrete next action, and shows the evidence it is based on.
   Anything that can't do all three doesn't get sent.
3. They act, defer, or dismiss. Dismissing is a first-class action and it is recorded.
4. When they act, the AI has already drafted the artifact — the proposal text, the summary, the
   update — so acting is editing.
5. What they dismissed shapes what they are shown next time.

**What memory does:** memory supplies the interpretation ("this matters because of the commitment
we made in March"); the activity ledger supplies the detection ("this changed").
**Why it feels intelligent:** it respects attention. The measure of this journey is not how much
the AI says, but how rarely it is wrong to speak.
**How we know it works:** the acceptance rate. If fewer than roughly a third of items are acted on,
the channel is noise and should be turned off rather than tuned.

---

## Journey 4 — The steward keeps the organization coherent

**Who:** whoever holds responsibility for the organization staying true to itself.
**Wants:** to notice drift before it becomes a crisis.

1. They see where **stated intent and actual behaviour have diverged** — we said this was the
   priority, and here is where the attention and money actually went.
2. They see which beliefs have gone **stale** (nobody has revisited this in a year) or **contested**
   (two parts of the org are acting on incompatible assumptions).
3. They review memory changes proposed by the AI and by connected apps, and approve, edit, or
   reject them. This is the main way memory quality is maintained.
4. They can retire beliefs that no longer hold, with the reason recorded.

**What memory does:** this journey is memory _maintenance_ — the gardening that keeps the corpus
small, current, and trusted.
**Why it feels intelligent:** the organization can be wrong out loud. Surfacing contradiction is
more valuable than projecting false consensus.
**How we know it works:** the memory corpus stays small enough for a person to read in an
afternoon, and its age profile stays healthy.

---

## Journey 5 — The organization decides, and then learns

**Who:** the membership, at a governance moment.
**Wants:** to decide well, without being asked to approve everything.

The failure mode this journey has to avoid is approval fatigue. If every good idea becomes
something everyone must vote on, participation collapses and the votes that matter get rubber-
stamped alongside the ones that don't. **Most decisions must never reach a vote.** So the journey
begins with routing, not drafting.

1. **The decision is routed to a tier.** The AI proposes the lowest tier that fits, names the
   mandate it believes already covers this, and has to argue for escalation rather than default to
   it. See [decision rights](../architecture/organizational-intelligence.md#8-decision-rights--what-becomes-a-proposal)
   for the test and the tiers.
2. **Most things stop here** — done inside an existing mandate and logged, or waved through by the
   one person who holds that envelope, or opened for a short objection window that closes in silence.
3. **What remains goes to a vote**: commitments of shared resources beyond an existing mandate,
   changes to the rules, and changes to who counts as a member. The AI drafts it grounded in memory,
   and states what it is assuming and what would make the proposal wrong.
4. Members can see what the organization decided before on similar questions, and what happened as
   a result.
5. The decision is made by people, on-chain where it matters.
6. **The outcome is recorded against the decision** — did it do what we expected?
7. Later, when reality disagrees with the prediction, the AI proposes updating the belief that
   produced it. A steward approves.

**What memory does:** step 1 depends on memory knowing the organization's mandates; step 6 is what
turns a record into learning. Without step 6 the organization has a filing cabinet, not
intelligence.
**Why it feels intelligent:** the organization protects its own attention. Being asked to vote
means something, because it happens rarely and only about things that are genuinely shared.
**How we know it works:** two numbers. The share of votes that pass near-unanimously with no real
discussion should be _low_ — a high rate means we are taxing everyone with decisions that belonged
at a lower tier. And the same argument should stop recurring, with beliefs carrying a visible
history of revision.

---

## Journey 6 — The investor or funder

**Who:** someone with capital at risk and no operational role. A token holder, an impact investor, a
grant funder, a philanthropic backer.
**Wants:** to know whether the organization is doing what it said it would, without anyone having to
prepare a report.

1. They open a **standing overview**, not a quarterly deck. It answers: what did this organization
   say it would do, what has it done, where is the money, what changed since I last looked, and what
   is at risk.
2. The overview is a **view over the same memory and ledger the members use**. It is not a separate
   narrative maintained for outsiders.
3. Claims that matter are **verifiable rather than asserted**. Treasury movements, votes, and
   membership changes settle on-chain, so the investor can check instead of trusting. The AI's job is
   to explain that record in plain language and keep the underlying proof one step away. This is also
   the whole of the verifier's journey.
4. **They can respond.** An observation, concern, or question becomes a signal in the organization's
   normal triage — visible, owned, and answerable. It does not become an instruction.
5. On **reserved matters** — changing the purpose, diluting holders, disposing of major assets —
   their consent is required. That is a distinct decision class with a distinct constituency, not a
   normal member vote.
6. If they flag a risk that turns out to be real, or decline to fund again, that becomes part of
   decision memory too.

**What memory does:** it removes reporting as a separate activity. Because the report is a view, it
costs almost nothing to produce and cannot quietly drift from what members see.
**Why it feels intelligent:** the investor gets a current and honest picture, including the arguments
the organization has not settled. Counter-intuitively that builds more confidence than a polished
one, because it is checkable.
**How we know it works:** reporting effort per funder trends toward zero, and investor-raised signals
get resolved rather than parked.

> **Design constraint: one organization, one memory, different views.** The moment an investor-facing
> narrative is maintained separately from what members see, we have built an investor-relations tool
> and destroyed the thing that made it trustworthy. Curation may legitimately differ — privacy,
> granularity, commercial sensitivity. The underlying beliefs may not.

---

## Journey 7 — The beneficiary

**Who:** the people the organization exists to serve — an energy community's households, a
cooperative's customers, a neighbourhood.
**Wants:** to know what to expect, and to be heard when reality doesn't match it.

1. They see what the organization has committed to that affects them, in plain language, without
   reading governance records.
2. They report **what actually happened** — the bill went up, the service failed, the promise landed.
3. **That report is the organization's outcome signal.** This is the Observe step of the loop closing:
   the organization predicted an effect, and the people on the receiving end say whether it occurred.
4. Where beneficiary experience contradicts a stated belief, the AI surfaces the contradiction and
   proposes revising the belief. A steward approves.

**What memory does:** beneficiaries supply the ground truth that decision memory needs. Without them
the organization grades its own homework, and its "learning" is just internal argument.
**Why it feels intelligent:** the organization can be corrected by reality rather than only by
whoever argues best in a meeting.
**How we know it works:** beneficiary reports actually change beliefs. If they never do, we have
built feedback theatre.

---

## Journey 8 — The partner or ecosystem steward

**Who:** whoever holds a network, federation, or parent organization.
**Wants:** to spot what one part has learned that another part needs.

1. Patterns across member organizations are surfaced — the same risk appearing in three places, a
   solution one org found that two others are still struggling with.
2. Relevant insight is relayed between organizations as a signal, with its provenance intact.
3. Each receiving organization decides for itself whether to adopt it. Nothing is imposed downward.
4. Network-level memory accumulates: what tends to work, in what conditions.

**What memory does:** portable, self-describing memory artifacts are what make cross-org transfer
possible without merging anyone's data.
**Why it feels intelligent:** organizations learn from each other's experience without surveillance
and without central control.
**How we know it works:** relayed insight gets adopted, and adoption improves outcomes.

---

## Journey 9 — The builder or integrator

**Who:** someone building a specialized tool — energy modelling, CRM, impact measurement.
**Wants:** their tool to make the whole organization smarter, without handing over their data model.

1. They build their app with its own local data, in whatever shape suits it.
2. When their app produces something the organization should _know_ — an assessment, a risk, a
   recommendation — it promotes that as a memory artifact.
3. Hypha never learns their schema. The shared layer is meaning, not tables.
4. Their insight now appears in every member's digest and in every AI answer, attributed to their
   app.

**What memory does:** memory is the integration surface. This is what makes the platform
extensible without becoming a data warehouse.
**Why it feels intelligent:** the organization's understanding improves as tools are added, rather
than fragmenting across them.
**How we know it works:** an external app can contribute a genuine insight without any Hypha-side
schema change.

---

## What we are deliberately not promising

Naming these protects the product from the most attractive wrong turns.

- **The AI does not decide.** Not on money, membership, or governance.
- **The AI does not act unattended** on anything with external consequences.
- **The AI does not interrupt without evidence.** If it cannot cite what it is reasoning from and
  name who should act, it stays quiet.
- **The AI does not silently edit memory.** Every change to what the organization believes passes
  a human.
- **Memory is not a search index over everything ever said.** It is a small, curated, current
  account of what the organization believes and has decided. See the architecture document for why
  this distinction is load-bearing.

---

## What success looks like

Five measures, in priority order:

1. **Recommendation acceptance rate** — of the things the AI proactively raised, how many did a
   human act on? This is the single honest measure of whether we built intelligence or noise.
2. **Time to usefulness for a new member** — how long from joining to first real contribution.
3. **Memory health** — is the corpus small, current, and actively revised, or growing and stale?
4. **Decisions with recorded outcomes** — what fraction of decisions can we say the result of? This
   is the ceiling on how much the organization can learn.
5. **Consensus-vote rate** — what share of votes pass near-unanimously with no substantive
   discussion? This one should be _low_. A high rate means decisions that belonged at a lower tier
   are taxing everyone's attention, and approval fatigue is being manufactured.

Notably absent: messages sent, questions answered, artifacts created, **and proposals raised**.
Those are activity, and optimizing them produces exactly the wrong product — a system that
generates governance rather than one that resolves it.

---

## Related

- [Organizational Intelligence — Architecture](../architecture/organizational-intelligence.md) —
  how memory is maintained, retrieved, and bounded to serve these journeys
- Space Intelligence & Documentation spec — the memory substrate; arrives with
  [PR #2461](https://github.com/hypha-dao/hypha-web/pull/2461)
- [Documents and media overview](../architecture/documents-and-media-overview.md) — where raw files
  live
