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
exists to serve. Written for the whole team — no code required. For screens and click-paths see
[User Journeys — UI and flows](./user-journeys-ux.md).

---

## The promise, in one sentence

> Anyone in a Hypha organization opens the app and immediately knows what matters and what to do
> next — because the organization remembers, and the AI keeps that memory active.

Everything below is a way of delivering that sentence to a specific kind of person on a specific
kind of day. Both halves of it — _what matters_ and _what to do next_ — resolve differently for a
contributor, a steward, and a Shaper; see
[what each stakeholder opens the app for](#what-each-stakeholder-opens-the-app-for).

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

## Stakeholders

Two things to hold before reading the list.

**These are roles, not people.** In a five-person organization, one person is plausibly founder,
shaper, steward _and_ beneficiary at once. The taxonomy answers "what does this person need right
now", not "what is their job title". Someone can move between rings, and most people do.

**Shapers decide memory, and Shapers decide who is a Shaper.** The founder names the first set.
After that, only Shapers can add or remove Shapers, and only Shapers can change what the
organization believes. Stake still governs the _view_ — capital gets to see honestly and be heard,
a person with no stake yet reads what the organization publishes — but it does not grant a write
to memory. A contributor who is not a Shaper does the work; they do not edit the corpus.

### Ring 1 — Inside: members who hold decision rights

They stake time and judgment. They read memory. Only Shapers change it.

- **Founder** — the person who initially sets up the organization. A one-time role. They name the
  first Shapers, the first steward mandates, and the entry and exit methods, then they are a member
  like anyone else — usually also a Shaper, but "founder" is not an ongoing decision right.
- **Shaper** — a grant, not an exclusive role. Shapers decide high-level strategy, who else is a
  Shaper, who holds a pot of money and how big it is, and organizational memory. A steward or a
  contributor can also be a Shaper. Strategy becomes more specific work that passes to stewards.
- **Steward** — accountable for a domain; holds a mandate and a budget envelope; approves the
  implementations that strategy has become.
- **Contributor** — does the work the steward has approved. The majority. A Shaper only if granted
  that hat.

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

| Stakeholder     | Stakes                  | Memory access                                  | Decision rights                                                      | Journey |
| --------------- | ----------------------- | ---------------------------------------------- | -------------------------------------------------------------------- | ------- |
| Founder         | purpose, reputation     | writes the seed corpus                         | sets the organization up once; then only as Shaper and/or other hats | 1       |
| Shaper          | judgment over the whole | reads all; decides memory                      | strategy, who is a Shaper, pots, memory, the steward set             | 5       |
| Steward         | domain accountability   | reads all; may suggest, does not decide memory | approves implementations and spends inside their mandate             | 4       |
| Contributor     | time, judgment          | reads all                                      | does the work; shapes only if also a Shaper                          | 2, 3    |
| Investor/funder | capital                 | curated view, including unsettled arguments    | consent on reserved matters only                                     | 6       |
| Beneficiary     | dependency on outcome   | published subset; contributes outcome reports  | none; consulted when decisions land on them                          | 7       |
| Partner org     | joint commitments       | artifacts relayed to them                      | decides for itself                                                   | 8       |
| Prospective     | attention               | the public brief                               | none                                                                 | 2       |
| Builder         | effort, reputation      | writes via app identity; proposes only         | none                                                                 | 9       |
| Verifier        | their own assurance     | specified claims plus on-chain proof           | none                                                                 | 6       |

Journeys 1–5 sit inside the organization, 6–7 at the committed edge, 8–9 outside it. The catalog
below is what "decision rights" actually means.

### What has to be decided, and by whom

The tiers in the [architecture](../architecture/organizational-intelligence.md#8-decision-rights--what-becomes-a-proposal)
say how much agreement a decision needs. This section says **which decisions exist** and **which
person or body takes each one**. Four sentences hold the whole catalog:

1. **The founder sets the organization up once:** purpose, who the first Shapers are, how votes
   work, entry and exit, and the first steward mandates. The AI proposes; the founder confirms.
2. **Shapers decide high-level strategy, who is a Shaper, who holds a pot of money and how big it
   is, and organizational memory.** They are the body that can change the constitution or the
   steward set. A steward or contributor can hold this grant if the Shapers add them; the founder
   usually names themselves in the first set, but that is a choice.
3. **Stewards approve implementations and spend from their pot.** Strategy becomes more specific
   work that passes to them. An AI ticket is a recommendation. It does not become work until the
   matching steward approves, rejects, or holds it.
4. **Contributors do the approved work.** Shapers do not sign every payment. They fill a pot once;
   the steward spends from it in public.

#### A. Founding — founder confirms, AI proposes

The interview that produces these is in [Journey 1](#journey-1--the-founder-starts-an-organization).
The founder confirms; the AI does not invent a slot they never spoke to.

- Purpose, who it serves, boundaries, and success signals (the seed memory).
- First strategic objectives for the next 90 days.
- **Who the first Shapers are** — drafted from "who do you trust to decide," not from job titles.
- Entry and exit method.
- The first mandates: one per real near-term job — domain, steward, pot, review date, optional
  cosigners.
- A reminder the AI never decides money, membership, or memory. People do.

After this, "founder" is a historical fact, not a queue. Ongoing strategy, funding, and memory sit
with the Shapers.

#### B. Structure — Shapers

Tier 3, or Tier 4 when the decision changes how decisions get made.

- Create, change, or close a mandate — one decision, see below.
- Remove or replace a steward. A steward can resign without a vote; filling the seat is a Shaper
  decision. A steward cannot fire themselves out of accountability.
- Change who is a Shaper, the voting method, the purpose, or entry and exit.
- Issue, mint, or burn tokens; space-to-space membership; activating a space.

#### How a mandate is created

A mandate is not a strategic essay with money taped on, and strategy is not a second vote that later
becomes a mandate. Those two designs both add a step.

**Strategy is what we believe. A mandate is a job.** "We exist to regenerate this watershed" is
memory. "Alex holds community, up to 5,000, until September" is a mandate. Purpose changes, who is
a Shaper, and entry rules stay strategy. They never need a steward or a pot.

When the job _is_ the decision, Shapers decide it **once**, as one object:

> this domain, this steward, this pot (which may be zero), this review date, and optionally who
> must cosign to release funds

The AI drafts that object. Shapers approve, amend, or reject it. Attaching funds is a field on the
same proposal, not a follow-up. A job with no money is still a mandate — someone owns the work. A
pot with no job is not a mandate; that is the slush fund we already rejected.

Where the draft comes from, in order of honesty:

1. **A ticket with no steward** — the AI must draft the mandate on that first ticket. Further
   tickets in the same gap attach to the same proposal. This is the default after founding.
2. **Founding** — the AI proposes the first set; the founder confirms.
3. **A Shaper proposes** — allowed, and weaker than a ticket the matcher could not place.

There is not a separate "strategy vote" that later spawns a mandate. If a belief change implies a
new job, the AI puts the mandate on the same item: here is what we would now believe, and here is
the job it creates. One queue, one decision.

#### C. Work tickets — matching steward, before anyone starts

- Approve, reject, or hold. A hold must carry a resumption trigger — a date or a condition —
  because a hold without one is a silent no that nobody has to own.
- A steward may set standing rules ("auto-approve tickets of type X under size Y"). That is them
  using the mandate, not a new decision class, and it is how they avoid becoming a per-ticket
  bottleneck.
- **No matching steward:** the AI must file a mandate proposal to the Shapers at once — this
  domain, this pot, this review date, a steward if it can name one. The ticket stays open and
  attaches to that proposal. It is not silently dumped on a Shaper as permanent work, and it does
  not wait to "accumulate."
- The contributor then claims, declines, or acts. That is a personal decision, not an organizational
  one.

#### D. Funding

A **mandate** is a job with a pot attached: this domain, this steward, this much money, until this
review date, and **optionally who must cosign to release funds**. **Funding a mandate** is the
Shapers filling that pot. It is one decision. After it, the default is that the steward spends
without asking again.

That is the whole point. The alternatives fail the aim — minimum bureaucracy, full transparency,
trust — in opposite directions:

- **Shapers approve every money movement.** Maximum control, and the bureaucracy we are trying to
  kill. The treasury becomes a queue of invoices. Trust is replaced by surveillance.
- **Shapers just hand a person a budget, with no domain or review date.** Almost the same idea,
  but the pot is a slush fund. When the person leaves, the money is unexplained. When they overspend,
  there is no job to point at. Trust without a scope is how treasuries get drained by conscientious
  people who thought they were allowed to.
- **No pot at all, steward spends freely, everything visible.** Transparency without a bound. Someone
  still has to watch every payment, which is option one with extra steps.

So the pot is not extra process. It is the _minimum_ process that lets Shapers stop looking. Trust
is granted up to a number, for a job, until a date. Every payment is still on the ledger — full
transparency — and a Shaper can set a standing watch ("tell me if this pot is 80% gone").

**Cosigners are how concern becomes a check on one pot, not a rule for every pot.** Default is
none. If Shapers are uneasy — a new steward, a large pot, a sensitive domain — they name who must
also sign before funds leave that pot. That can be one or more of themselves, the parent steward,
or another trusted body. The steward still initiates the payment; it does not move until the
named people release it.

This stays a field on the mandate, set when the pot is created or changed, and removable at review
when the concern has passed. It is not a standing Shaper queue. If every pot has the org Shapers
as cosigners, we have rebuilt "approve every movement" under another name. Use it where trust is
not yet full. Leave it off where it is.

What Shapers decide, and only this:

- Fill, refill, enlarge, shrink, or close a pot (create or change a mandate).
- Set, change, or clear the cosigners on a pot.
- A payment that **no pot covers** — there is no steward for this, or this one spend would overflow
  the pot. That is the only sense in which they "fund beyond a mandate."
- Dispose of major assets or dilute holders, with investor consent where that is reserved.

What they do not decide by default: the contractor invoice, the tool subscription, the contributor
payment that already sits inside a live pot with no cosigners. That is the steward doing their job.
If Shapers disagree with how a pot is being used, they resize it, close it, or add a cosigner —
they do not start countersigning pots they never marked.

#### How it looks with 10 members, and with 10,000

Same rules. Different depth. A member is not a Shaper — ten thousand people working does not mean
ten thousand people filling pots.

**With 10 members**

One layer. Three or four Shapers (often the same people as the stewards). Two or three mandates.

Example: the treasury is 20,000.

- Community — Sam — 8,000 — review in June
- Product — Lea — 12,000 — review in June

Sam pays a facilitator from the community pot. Nobody else signs — neither pot has a cosigner.
Lea pays a designer from the product pot. The Shapers see two numbers: how much each pot has left.
When unmatched tickets pile up in "legal" and nobody owns that, the AI drafts a third mandate.
Until then there is no third pot, and no chart for its own sake.

If the org is even smaller — one person wearing every hat — there is a single mandate, pot equals
the treasury, review in a few months.

**With 10,000 members**

Still a handful of Shapers. Still a handful of pots _those Shapers see_. The rest is the same
object, one level down.

Example: the treasury is 2,000,000. Org Shapers fill five pots, not fifty.

- Product — Lea — 800,000 — review in June — two Shapers cosign (the pot is large, Lea is new)
- Community — Sam — 400,000 — no cosigner
- Operations — Miro — 300,000 — no cosigner
- …two more

Lea still does not ask the org Shapers every time product needs a narrower job. She carves from
her remaining 800,000:

- Mobile — Rafi — 200,000 — review in April
- Protocol — Noa — 350,000

Rafi pays engineers from the mobile pot. Lea may put herself as cosigner on that sub-pot; the org
Shapers do not. She sees burn on mobile and protocol. Org Shapers see burn on product, and they
still release Lea's own product-level payments until they drop the cosign at review. If Lea
closes product, mobile and protocol freeze.

Two or three levels of that is enough. Eight pots, each split eight ways, each split eight ways
again, is already room for hundreds of teams. The org Shapers never look at hundreds of pots.

What each person opens:

|                     | 10 members                           | 10,000 members                                                 |
| ------------------- | ------------------------------------ | -------------------------------------------------------------- |
| Shaper home         | two pots, a bit of leftover treasury | five top-level pots                                            |
| Steward home        | their one pot and its tickets        | their pot, any pots they carved, their tickets                 |
| Contributor home    | the next approved ticket             | the next approved ticket                                       |
| Anyone, if they ask | every payment                        | every payment — the ledger is complete. The home screen is not |

The thing that must not happen at either size: the Shaper set grows with membership, or every pot
quietly gets the org Shapers as cosigners. Cosign is a mark on a pot you are concerned about, not
the way money always moves.

#### E. Membership — follows the entry method the founder set

The _method_ is a founding decision. Each _instance_ — this person joins, this person leaves —
follows that method. Changing the method is a vote. This catalog does not invent a default
"steward admits members"; the founder chose the gate.

#### F. Memory

- Any change to what the organization believes — purpose, strategy, a domain assessment, a
  retired claim — → the Shapers. The AI or anyone else may draft; only Shapers approve.
- An assertion with no ledger support, a contradiction between artifacts, or stalled onboarding →
  the Shapers confirm, retire, or escalate.

#### G. Reserved matters and the edge — heard is not authority

- Purpose change, dilution, major-asset disposal → Shapers **plus** investor consent.
- Decisions that land on the people the organization serves → Shapers decide; beneficiaries are
  consulted.
- Partner commitments → each organization decides for itself.
- An investor adding, holding, or exiting; a beneficiary reporting an outcome; a prospect
  expressing interest — individual actions, listed here so they are not mistaken for organizational
  decisions.

### What each stakeholder opens the app for

The promise at the top of this document — _knows what matters and what to do next_ — means something
different for each of them. Below is that sentence made specific: the one question each arrives
with, what answers it, and what they can actually do about it.

Four rules govern all ten:

1. **One question, answered before anything is asked of them.** The landing state is the answer, not
   a dashboard of everything with the answer somewhere inside it.
2. **The next action must sit inside their authority.** Showing someone a problem they have no lever
   for is not transparency, it is anxiety. For Rings 2 and 3, acting means asking, watching,
   reporting, or disputing — never directing.
3. **"Nothing needs you" must be sayable.** A surface that can never come up empty will manufacture
   urgency to fill itself, and then everything on it is noise.
4. **Outside Ring 1, bad news goes first.** A curated view that only carries good news is discounted
   to zero within two cycles, and after that the honest reports cannot be heard either.

#### Ring 1 — inside

**Founder — _"Is the organization standing?"_**
Only while they are setting it up: the seed memory, the first Shapers, the first steward mandates.
Once those are confirmed, this surface closes. Anything later that looks like strategy is a Shaper
question — even if the same person is looking at it.

**Shaper — _"Is the strategy still right, and is it becoming work?"_**
Direction, purpose, whether each pot is the right size, and the beliefs those rest on — plus work
that still has no steward, which is a strategic gap rather than a ticket they should do themselves.
They
confirm, revise, or retire a claim, and they pass more specific work to the matching steward.
Adding a steward is a Shaper decision, not a mandate one person creates alone. A steward or
contributor who is also a Shaper sees this surface as well as their other one. This is the human
end of the
[behavioural-evidence rule](../architecture/organizational-intelligence.md#1-four-layers-of-memory).

**Steward — _"What implementations are waiting on me, and is my domain drifting?"_**
Every AI-created ticket inside their mandate that has not yet been green-lit — the specific work
that strategy has become, already carrying a recommended contributor — plus envelope burn measured
against the review date. They approve, reject, or hold **before anyone starts**, and they can
change the named person. **A hold must carry a resumption trigger**, a date or a condition, because
a hold without one is a silent no that nobody has to own. Repeated rejections of similar items are
evidence that the routing or the mandate boundary is wrong, not that the steward is being
difficult.

**Contributor — _"What needs me?"_**
A queue with one item at the top, not a dashboard: steward-approved work routed to them, plus
changes to work they already own. They claim, decline, or act on an artifact the AI has already
drafted. Declining distinguishes _not my thing_ from _no room right now_. When nothing needs them it
says so plainly — the willingness to show an empty queue is what makes a full one credible.

#### Ring 2 — the committed edge

**Investor or funder — _"Is my capital doing what it was meant to, and should I add, hold, or
exit?"_**
Commitments made against commitments kept, burn against plan, and the arguments the organization has
not yet settled. The actions are the honest ones available to someone without operational authority:
ask a question that memory answers with evidence, file an observation, **set a standing watch**
("tell me if runway falls below six months"), or move their position. The watch matters most — it
converts a periodic-report reader into someone subscribed to the facts they actually care about.
Credibility here is asymmetric: what earns it is the organization surfacing a problem before the
investor finds it themselves. Sometimes the honest answer to "should I invest" is _not yet_, and a
system willing to say that is the only kind worth reading.

**Beneficiary — _"Is this actually helping, and can I say what I need?"_**
Outcomes in language they recognize, not governance activity — they do not care that proposal 12
executed. They report whether something helped, or file a need. Those reports are the organization's
ground truth and feed decision memory. Asking beneficiaries for input and never showing them a
change that came from it is extractive, so the loop has to close visibly.

**Partner organization — _"Are our joint commitments on track, and what do they need from us?"_**
Only the shared surface: commitments between the two organizations, never the partner's internals.
They confirm, dispute, or flag a dependency at risk, then take it to their own members. The failure
worth designing against is the joint commitment each side assumes the other owns, so unclaimed
shared commitments surface to both.

#### Ring 3 — outside

**Prospective member — _"Is this real, and is there something here for me?"_**
The public brief, evidence the organization is actually doing things, and — the important part —
open work nobody has picked up that matches what they say they can do. The unmatched queue
_is_ the recruitment surface: the capacity gap and the joining funnel are one list read from two
directions. They express interest against a specific piece of work, so joining arrives with a first
task attached instead of a generic welcome.

**Builder or integrator — _"Is what my tool contributes being used?"_**
The acceptance rate of artifacts their app has published: read, acted on, or ignored. They publish,
and they see what became of it. Integrators leave when their output disappears into a void.

**Verifier or auditor — _"Is this one claim true?"_**
One claim, its evidence chain, and the on-chain proof. They verify or dispute, and a dispute becomes
a signal the organization has to answer. They should need no account and no relationship to do it —
verification that depends on trusting the platform is not verification.

---

## Journey 1 — The founder starts an organization

**Who:** someone with a purpose and no structure yet.
**Wants:** to go from an idea to a real organization others can join, without learning governance
theory first.

1. They describe what they're trying to do, in their own words, in conversation.
2. **The AI interviews them — not a form.** It is trying to learn the few things without which it
   cannot recommend Shapers, objectives, mandates, or stewards. It draws on comparable
   organizations to ask sharper questions, and it stops when it can draft. The key things:

   **What this is** — so strategy has somewhere to sit.

   - What is this for, in a sentence they would say to a stranger?
   - Who is it for — who is helped if it works?
   - What will you not do, even if it would be easy or funded?
   - In six months, what would you point at and say "this is working"?

   **Who is already here** — so Shapers and stewards are named from reality, not an org chart.

   - Who is already doing work, and what do they actually do?
   - If you disappeared for a month, who do you trust to decide? Those names are the first
     Shaper draft.
   - Who would you not hand the treasury to yet? That is the first cosign signal, not a judgment
     of character.

   **What must happen next** — so the first mandates are jobs, not departments.

   - What has to get done in the next 90 days?
   - What is already blocked for lack of a person or of money?
   - If you could spend tomorrow, on what?

   **Money and the door** — so pots, entry, and capital have a first setting.

   - Is there a treasury yet, roughly how much, and who can move it today?
   - Any pot that should need a second signature from the start?
   - How does someone join? Who puts money in, and what do they get to say about it?

3. It proposes a structure the founder edits rather than invents, each piece grounded in an
   answer above:

   - Seed memory: purpose, who it serves, boundaries, success signals.
   - First strategic objectives for the next 90 days, written as outcomes, not a slogan.
   - **Who the first Shapers are** — usually "who you trust to decide," plus themselves if they
     want that hat. Not automatic.
   - **First mandates** — one per real job in those 90 days: domain, steward (someone already
     doing it, or open if nobody is), pot, review date, cosigners only where they were uneasy.
   - Entry and exit. The AI never decides money, membership, or memory.

   Empty answers stay empty. It does not invent a legal steward because the form had a slot. An
   unmatched 90-day job with no name becomes an open mandate — the first recruitment surface.

4. **The conversation becomes the organization's first memory.** Purpose, boundaries, success
   signals, the first objectives, and the first mandates are written as founding artifacts — not
   buried in a chat log.
5. The founder is shown what was recorded and asked to confirm it. This is the first approval.

**What memory does:** this journey _creates_ the seed corpus. Nothing else works well without it.
**Why it feels intelligent:** the founder never sees an empty form, and the first recommendations
are about their next 90 days, not a generic DAO template.
**How we know it works:** the founding artifacts are still being cited and revised six months
later, instead of abandoned — and the first mandates still match work that actually happened.

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

## Journey 3 — The contributor uses the app

**Who:** someone who does the work. They may also be a steward or a Shaper; this is the hat they
wear when they open the app to _do_ something.
**Wants:** one next thing, already scoped, already allowed, already drafted.

They open the app. The first thing they see is **What needs me?** — not a dashboard, not a chat.

1. **If nothing needs them, it says so.** An empty queue is a successful screen. They can leave.
   If they have work already in progress, that sits under the empty line: one card per open item,
   last action, next suggested step.
2. **If something needs them, one ticket is on top.** A steward has already said this work should
   happen and that they are the person. The card shows why them, one concrete next action, and the
   evidence. The AI has drafted the artifact — the update, the proposal text, the summary.
3. **They claim, decline, or act.**
   - Claim: the ticket is theirs. They can still walk away later.
   - Decline: they must pick _not my thing_ or _no room right now_. Those teach the matcher
     different lessons. They can set or revise how much they can take on — a coarse number of
     concurrent items, not hours.
   - Act: they edit the draft, not a blank page. When they are done they mark it done. The steward
     can see it finished; they do not re-approve the work unless the mandate said so.
4. **They can ask, in the ticket, what this is for.** The answer cites memory and the mandate, not
   a guess. They should never have to hunt a chat history to start.
5. **Work they already own stays visible until it is done or they decline it.** A change to that
   work (new context, a blocked dependency) surfaces on the same card. It does not become a second
   queue.
6. **If they wear another hat, they switch.** Steward tickets and Shaper decisions are other
   surfaces, not mixed into this queue. Mixing them is how contributors stop trusting "What needs
   me?"

Capacity is theirs to declare. The system may say "this would be your fifth and you said three";
it may never refuse on their behalf. Matching must not only pick people who have done this before
— a minority of tickets should be stretch — but that is the steward's call when they confirm the
name, not something the contributor has to negotiate.

**What memory does:** it is why the ticket is already written and why "why me" has a citation.
**Why it feels intelligent:** they open the app, do one thing or leave. They are not a dispatcher.
**How we know it works:** time from open to first action; share of tickets claimed vs declined;
empty-queue days that the person trusts rather than assumes are a bug.

---

## Journey 4 — The steward uses the app

**Who:** someone accountable for a domain, with a pot and a review date.
**Wants:** to say yes or no to work in their patch, and to keep the pot honest — not to become
the person who does every ticket.

They open the app. The first thing they see is **What is waiting on me?**

1. **Tickets to green-light.** Each one already has a recommended contributor, a next action, and
   evidence. They approve, reject, or hold. They can change the person. A hold needs a date or a
   condition to resume. A standing rule ("auto-approve type X under size Y") covers both the work
   and the name, so they are not a per-ticket bottleneck.
2. **Until they confirm, the ticket does not reach a contributor.** After they confirm, it does.
   They can re-route later if the person declines.
3. **Their pot.** How much is left, what went out, whether a cosigner is sitting on a payment they
   started. They pay from the pot; they do not ask Shapers to sign unless this pot named
   cosigners. If the pot is large they can carve a sub-mandate — narrower job, person, amount,
   review date — without a Shaper vote.
4. **Review date.** How the domain is doing against what the mandate said. They do not edit
   organizational memory here. They can draft a belief ("this risk is overstated") and send it to
   Shapers.
5. **What they do not see as their job:** a ticket with no steward. That is already a mandate on
   the Shaper queue. They are not the overflow.

Matching must not only pick people who have done this before. They should change the name toward
stretch some of the time, and treat a capability only one person holds as a risk to mention at
review.

**What memory does:** it tells them why this ticket exists and whether the pot still matches the
job.
**Why it feels intelligent:** they are a gate, not a project manager of the whole org.
**How we know it works:** time from ticket-in to steward call; share of standing-rule approvals;
holds that actually resume; pot overflow that did not happen.

---

## Journey 5 — The shaper uses the app

**Who:** whoever holds the Shaper grant. They may also be a steward or contributor; this surface
is only the decisions that belong to Shapers.
**Wants:** to keep strategy, money-as-pots, and memory true — without doing the work or signing
every payment.

They open the app. The first thing they see is **What needs a Shaper?** If the answer is nothing,
it says so.

1. **New mandates.** A ticket the AI could not place with a steward is already drafted as a
   mandate: domain, steward if it can name one, pot, review date, optional cosigners. They
   approve, amend, or reject. Further tickets in that gap are attached to this item, not a second
   vote.
2. **Pots.** The handful of top-level pots they filled: remaining, burn, review dates. They
   refill, resize, close, or add/clear cosigners. They do not see Rafi's mobile invoices. They
   release a payment only if they are named as a cosigner on that pot.
3. **Memory.** Beliefs to confirm, retire, or correct — purpose, strategy, a domain claim the
   steward drafted, an assertion the ledger does not support. They write the corpus. No one else
   does.
4. **Who is a Shaper.** Add or remove. This is rare and hard on purpose.
5. **When something is actually a decision among Shapers** — a new pot, a purpose change, who is
   a Shaper — the AI has already drafted it, named what it assumes, and shown what happened last
   time the org decided something similar. They decide. The outcome is recorded. Later, if
   reality disagrees, the AI proposes updating the belief; they approve that too.
6. **They do not green-light tickets and they do not do the work** on this surface, even when the
   same person is also steward or contributor. Those hats have their own queues.

Most things never reach this screen. Work inside a live mandate is the steward's. A payment
inside a pot is the steward's. The Shaper queue staying short is the design working.

**What memory does:** it is the thing they maintain, and the thing every other journey reads.
**Why it feels intelligent:** they steer. They do not operate.
**How we know it works:** the queue is short; pots get reviewed on their date; the same argument
does not recur; the corpus still fits in an afternoon.

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
4. Their insight can now route work, appear in any member's queue, and inform every AI answer —
   attributed to their app.

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

- [User Journeys — UI and flows](./user-journeys-ux.md) — how someone joins, becomes a steward or
  contributor, and what each hat opens
- [Organizational Intelligence — Architecture](../architecture/organizational-intelligence.md) —
  how memory is maintained, retrieved, and bounded to serve these journeys
- Space Intelligence & Documentation spec — the memory substrate; arrives with
  [PR #2461](https://github.com/hypha-dao/hypha-web/pull/2461)
- [Documents and media overview](../architecture/documents-and-media-overview.md) — where raw files
  live
