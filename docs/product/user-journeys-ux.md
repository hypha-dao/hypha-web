---
title: 'User Journeys — UI and flows'
date: 2026-08-22
status: draft
tags: [product, journeys, ux, intelligent-org]
---

# User Journeys — UI and flows

How the intelligent organization **looks and moves** on screen. Companion to the
[product brief](./user-journeys.md) (roles, decisions, funding) and the
[architecture](../architecture/organizational-intelligence.md).

This file is the one to use when designing or building a flow. Each journey is a path through
screens, not a principle.

---

## How someone gets a hat

Hats are granted. Joining the org does not make you a contributor or a steward.

```
Outsider
   │  open entry, or request + accept
   ▼
Member          — inside the space; no work queue yet
   │
   ├─ Shapers offer a mandate ──────────────► Steward
   │                                            │
   └─ A steward invites them to do work ──────► Contributor
```

- **Member** — they got in. They can read what members may read, and they can be offered a hat.
- **Contributor** — a steward invited them to do work in that steward's domain. They now have
  **What needs me?**
- **Steward** — Shapers offered them a mandate (job, pot, review date) and they accepted. They now
  have **What is waiting on me?**
- **Shaper** — named at founding, or added later by existing Shapers. They have **What needs a
  Shaper?**

One person can hold several hats. Each hat is a **separate home**. Switching hats switches the
first screen, it does not dump every queue into one list.

---

## The three homes

After the person is in, almost every later flow lands on one of these. Design them first.

| Home                       | Who sees it  | First line                                           | Primary actions                               |
| -------------------------- | ------------ | ---------------------------------------------------- | --------------------------------------------- |
| **What needs me?**         | Contributors | One ticket, or "Nothing needs you"                   | Claim / decline / act                         |
| **What is waiting on me?** | Stewards     | Tickets to green-light, pot remaining                | Approve / reject / hold / change person / pay |
| **What needs a Shaper?**   | Shapers      | Mandates, memory, pots — or "Nothing needs a Shaper" | Approve / amend / reject                      |

A member with no hat yet sees **Your space** — purpose, who is here, open work they could be
invited onto — not an empty contributor queue. The invite is how they get a queue.

---

## 1. Founder creates the organization

**Who:** someone with a purpose and no space yet.
**Starts:** "Create a space" from the signed-in home.

1. **Conversation, not a form.** Full-width chat. The AI asks the [founding questions](./user-journeys.md#journey-1--the-founder-starts-an-organization)
   in their language. One question at a time. They can skip.
2. **Side panel fills as they talk.** Purpose, who it is for, boundaries, 90-day objectives, first
   Shapers, first mandates — each as a card that appears when that answer exists. Empty cards stay
   empty. No invented legal steward.
3. **Review screen.** Every card with a confirm control. They edit in place. Naming themselves a
   Shaper is a checkbox, off unless they turn it on.
4. **Entry method.** Two clear choices: _Anyone can join_ or _People request, Shapers accept_.
   Not a dropdown of ten governance modes.
5. **Create.** They land in the new space on **What needs a Shaper?** if they took that hat, else
   on **Your space**.

**If they quit mid-conversation:** draft space, resume the same thread.

A full run of this conversation, the cards she approves, and what Sam and Lea then see is
[Example A](#example-a--river-commons-from-a-conversation-to-a-ticket).

---

## 2. Someone joins — entry is open

**Who:** a prospect who has decided this space is real.
**Starts:** public space page.

1. **Public brief.** What this org is for, what it has actually done, what is still open, what
   is unresolved. Generated from memory. A list of **open work nobody holds** — the same list as
   unmatched tickets — with "this needs someone who can X".
2. **Join.** One button. No application essay.
3. **You're in.** They land on **Your space**. They are a **member**. They do not yet have
   **What needs me?** A short line: "A steward can invite you to work. You can say yes or no."
4. If they tapped a specific open ticket on the public page, that ticket is pinned on **Your
   space** as "you said you were interested" — a hint for the steward, not an assignment.

---

## 3. Someone asks to join — entry is request-only

**Who:** a prospect; Shapers on the other side.
**Starts:** same public brief, button reads **Request to join**.

1. Prospect writes a short note (optional) and can point at one open ticket. Submit.
2. They see **Request sent** and can leave. No fake "member" view.
3. Each Shaper's **What needs a Shaper?** gets a card: this person, their note, the ticket they
   pointed at, "Accept" / "Decline" / "Ask a question".
4. **Accept.** They become a member. They get **Your space**. If they pointed at a ticket, the
   matching steward sees "this new member is interested in X" on that ticket — still not a
   contributor until invited.
5. **Decline.** Prospect sees a short reason if the Shaper wrote one. No further access.

One Shaper accept is enough unless the space was founded with a harder rule. Do not send join
requests to every member.

---

## 4. A member becomes a steward

**Who:** Shapers offer; a member (or contributor) accepts.
**Starts:** Shapers decide a mandate is needed — founding review, or an unplaced ticket the AI
already drafted.

1. **Shaper sees a mandate card.** Domain, proposed person, pot, review date, optional cosigners.
   Person is a typeahead of members. AI may have pre-filled a name. They can change it, change the
   pot, add a cosigner, or pick _open — no one yet_.
2. **Offer.** The named person gets a distinct screen, not a buried notification: **You are being
   asked to hold [domain].** The mandate in plain language, the pot, the review date, who the
   Shapers are, what they would be saying yes to (green-light work, spend this pot, not write
   memory).
3. **Accept.** They become a steward. Next open of the app is **What is waiting on me?** Any
   tickets already waiting in that domain are there, each with a recommended contributor.
4. **Decline.** They write a short why if they want. The mandate card returns to Shapers with that
   note. The job stays open. They remain a member (or contributor). Nothing is taken from them.

Shapers do not "assign" a steward. They offer. The person has to take the hat.

---

## 5. A member becomes a contributor

**Who:** a steward invites; a member accepts.
**Starts:** steward is looking at a ticket, or at **People in this domain**.

**From a ticket**

1. Steward has a ticket with a recommended person. If that person is already a contributor in
   this domain, confirming the ticket is enough — it goes to **What needs me?**
2. If the recommended person is only a **member**, the steward sees **Invite to contribute**
   instead of a silent assign. One extra step: "Ask [name] to take work in [domain]." Optional
   note.
3. The member gets **[Steward] is asking you to contribute on [domain].** First ticket shown
   underneath, already drafted. **Accept** / **Not now**.
4. **Accept.** They become a contributor. The ticket is the first item on **What needs me?**
5. **Not now.** Ticket returns to the steward with the name cleared. They pick someone else or
   leave it open.

**From the people list**

Steward opens **People** → a member → **Invite to contribute**. No ticket required. The member
accepts and then has an empty **What needs me?** until a ticket is green-lit to them.

A contributor is per domain, not a global badge. Being invited by the community steward does not
put treasury tickets on their queue.

---

## 6. Contributor — do the next thing

**Who:** a contributor.
**Starts:** they open the space (or a push if something urgent and theirs).

1. **What needs me?**
   - Empty: "Nothing needs you." In-progress work, if any, listed below.
   - One card on top: title, why them (one line), next action, steward who approved it.
2. They tap the card. **Ticket screen:** the draft, the evidence, **Claim** / **Decline** /
   **Start**.
3. **Decline** asks _not my thing_ or _no room right now_, then they can change their capacity
   (a small number: "up to N things at once").
4. **Start** opens the draft in place. They edit. **Done** marks it finished. Steward sees it
   completed on the ticket; they do not re-approve unless that mandate said so.
5. **Why is this?** on the ticket opens a short answer with citations into memory and the
   mandate — not a chat dump.

If they are also a steward, a switch at the top takes them to **What is waiting on me?** It does
not mix the two lists.

---

## 7. Steward — green-light and spend

**Who:** a steward.
**Starts:** they open the space.

1. **What is waiting on me?** Two strips:
   - **Tickets** — count waiting, first card visible.
   - **Pot** — remaining / total, next review date, cosign pending if any.
2. They open a ticket. Recommended contributor, why, draft. Actions: **Approve** / **Reject** /
   **Hold** / **Change person**. Hold requires a date or a condition.
3. **Approve** sends it to that contributor's **What needs me?** (or starts the invite in
   [flow 5](#5-a-member-becomes-a-contributor) if they are only a member).
4. **Change person** is a member/contributor picker in this domain. Same invite rule.
5. **Pot.** List of payments. **New payment** — amount, to whom, for which ticket (optional).
   If this pot has cosigners, the payment sits as **Waiting for release** until they sign. The
   steward is not blocked from preparing the next one.
6. **Carve a pot** (if they have room): same four fields, smaller. The child appears under their
   pot. Org Shapers do not get a card.

A ticket with no steward for any domain does **not** appear here.

---

## 8. Shaper — decide the next structural thing

**Who:** a Shaper.
**Starts:** they open the space.

1. **What needs a Shaper?** If empty: "Nothing needs a Shaper." They can still open pots, memory,
   and people from a quieter secondary nav.
2. Cards, one kind per row:
   - **Mandate to offer** (unplaced ticket, or a Shaper-started draft)
   - **Join request** (only if entry is gated)
   - **Memory to confirm or retire**
   - **Cosign waiting** (only if they are named on that pot)
   - **Shaper change** (rare)
3. They open a mandate card, edit fields, **Offer** (flow 4) or **Reject** (ticket stays open,
   labelled, not assigned to them).
4. They open a memory card. Diff of the proposed belief. **Write** / **Edit** / **Dismiss**.
   Dismiss is recorded.
5. They open **Pots** from secondary nav to refill or add a cosigner — not because a payment
   needs them, because they chose to look.

They never see contributor tickets on this home.

---

## 9. No steward for a ticket

**Who:** AI, then Shapers, then the person who is offered the mandate.

1. A need is detected. No mandate covers it. **No steward queue.**
2. AI files one mandate card on **What needs a Shaper?** Ticket is attached underneath.
3. A second ticket in the same gap attaches to the **same** card.
4. Shapers offer the mandate ([flow 4](#4-a-member-becomes-a-steward)).
5. On accept, those attached tickets move to the new steward's **What is waiting on me?**, each
   still carrying a recommended contributor.

---

## 10. Pay from a pot, with and without a cosigner

**Without cosigner**

Steward: pot → new payment → confirm. Ledger updates. Shapers do not get a card. Anyone can open
the payment from the public ledger if they go looking.

**With cosigner**

1. Steward creates the payment. Status: **Waiting for release**.
2. Named cosigners get a card on **What needs a Shaper?** (or a dedicated **To release** if they
   are not Shapers — a trusted body can be a cosigner without that hat).
3. **Release** or **Refuse**. Refuse returns the payment to the steward with a reason.
4. On release, money moves.

---

## 11. Investor or funder looks in

**Who:** someone with capital at risk, no operational hat.
**Starts:** a link the space gave them, or their list of spaces.

1. **Overview** — not a member home. Four blocks: what we said, what we did, the pots, what
   changed since they last opened. Bad news first if there is any.
2. They can **set a watch** on a line ("runway under six months", "this pot hits 80%"). That is
   the only interrupt they should get.
3. **Ask** files an observation onto the Shaper or steward queue as a question, never as a
   ticket they assigned.
4. Reserved matter (purpose, dilution, major asset): they see **Your consent is needed** with
   the same draft the Shapers see. **Consent** / **Object**.

They cannot open **What needs me?** or green-light a ticket.

---

## 12. Beneficiary reports an outcome

**Who:** someone the org exists to serve, not a member.
**Starts:** a short public link, no account required if the space allows it.

1. One screen: "Did [this] help?" Yes / partly / no, plus optional note.
2. That report attaches to the mandate and to decision memory. Shapers see a memory card if the
   report contradicts a belief. Steward sees it on the review-date view of their pot.
3. Next time that beneficiary opens the link, they see **what changed from what you said** if
   anything did. If nothing did, the space should not ask again yet.

---

## 13. Someone puts a hat down

**Contributor** leaves a domain: from **What needs me?** → **Stop contributing here**. Open
tickets they hold go back to the steward. They stay a member.

**Steward** resigns: from **What is waiting on me?** → **Put this mandate down**. Waiting tickets
freeze and the mandate card returns to Shapers as "needs a steward". The pot freezes. They do not
pick their successor.

**Shaper** is removed only by other Shapers ([flow 8](#8-shaper--decide-the-next-structural-thing)).
They cannot remove the last Shaper.

---

## 14. One person, three hats

Sam is a Shaper, the community steward, and a contributor on product.

- Open the space → last hat they used, with a **switch** (Contributor / Steward / Shaper).
- **Contributor:** product tickets only.
- **Steward:** community green-lights and the community pot.
- **Shaper:** mandates, memory, top-level pots.

A community ticket they should green-light never appears on their contributor home. A Shaper
mandate never appears on their steward home. The switch is how we keep "Nothing needs you" honest.

---

## Worked examples

Three runs. A and B are River Commons, start to finish. C is a different space, written only as
**who is who** and **who sees what** at each moment.

---

### Example A — River Commons, from a conversation to a ticket

Maya is starting a neighborhood food hub. She taps **Create a space**.

#### What she says (the input)

The AI asks; she answers in her words. This is the whole of the founding interview that matters:

| The AI asks                                                | Maya says                                                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| What is this for?                                          | A place our street can buy food from people we know, not a supermarket.                             |
| Who is it for?                                             | Neighbours, and the three growers we already buy from.                                              |
| What will you not do?                                      | We will not run a restaurant. We will not take money that says we have to carry brands.             |
| What would "working" look like in six months?              | Open two days a week, five growers selling, enough in the pot to pay the hall without a whip-round. |
| Who is already doing work?                                 | Sam already runs the Saturday stall. I do the money and the hall booking.                           |
| Who do you trust to decide if you disappeared for a month? | Sam. And me.                                                                                        |
| Who would you not hand the treasury to yet?                | Sam is great with people. I still want a second pair of eyes on the money.                          |
| What has to happen in the next 90 days?                    | Keep Saturday going. Find a hall we can use in the week. Write down how we pay growers.             |
| What is already blocked?                                   | Weekday hall — I have no one for that.                                                              |
| If you could spend tomorrow, on what?                      | Hall deposit. A simple fridge. Paying Sam something so Saturday is not a gift.                      |
| Is there a treasury? Who can move it?                      | About 4,200 from a small grant. My account, for now.                                                |
| Any pot that needs a second signature?                     | The money one, yes.                                                                                 |
| How does someone join? Who puts money in?                  | Anyone on the street can join. The grant is one-off; neighbours can put in later. They don't vote.  |

She skips nothing important. She does not mention "legal" or "comms".

#### What the review screen shows (she approves or rejects)

**Memory — she writes all four**

- Purpose: a street food hub from people we know, not a supermarket.
- For: neighbours and the three growers.
- Will not: restaurant; brand money.
- Working, six months: two days a week, five growers, hall paid without a whip-round.

**Objectives, 90 days — she writes two, rejects one**

| AI drafted                                       | Maya                                                |
| ------------------------------------------------ | --------------------------------------------------- |
| Saturday stall stays open every week             | **Write**                                           |
| Weekday hall agreed and first mid-week day tried | **Write**                                           |
| A written rule for how growers are paid          | **Write**                                           |
| A comms steward and a newsletter                 | **Dismiss** — she never said this. Card disappears. |

**Shapers — she edits**

| AI drafted | Maya                                     |
| ---------- | ---------------------------------------- |
| Maya, Sam  | She leaves both. Checks "I am a Shaper". |

**Mandates — she offers two, leaves one open, refuses one**

| AI drafted                                                          | Maya                                       |
| ------------------------------------------------------------------- | ------------------------------------------ |
| **Stall** — Sam — pot 1,200 — review 1 June — no cosigner           | **Offer to Sam**                           |
| **Money and hall** — Maya — pot 3,000 — review 1 June — Sam cosigns | **Offer to myself** — she keeps the cosign |
| **Weekday hall** — open, no steward — pot 0 — review 1 June         | **Keep open** — no name to offer           |
| **Legal / contracts** — open — pot 400                              | **Reject** — not a 90-day job. Card gone.  |

**Door:** _Anyone can join._

She taps **Create**.

#### What Sam sees (becoming steward, then the queue)

Sam is not in the space yet. He gets **You are being asked to hold Stall** — pot 1,200, review
1 June, Shapers Maya and Sam, "you green-light stall work and spend this pot; you do not write
what the hub believes."

He taps **Accept**. Next open is **What is waiting on me?**

Two tickets the AI already made from the 90-day jobs, sitting under Stall:

1. **Pay Sam for four Saturdays** — recommended: Maya (she holds money). Draft: a payment of 400
   from the Stall pot, four lines of dates. Why Maya: she moves money today.
2. **Write the Saturday setup so someone else could run it** — recommended: Sam. Draft: a one-page
   setup (open, cash box, grower list). Why Sam: he already runs it.

Sam opens ticket 1. He **changes person** off Maya — he does not want her paying herself through
his pot — and picks _open_ for now. He **Holds** ticket 1 until "Maya has a second signatory on
the grant account."

He opens ticket 2. Recommended is him. He is the steward, not a contributor on Stall yet. He
**Approves** and **Invites himself to contribute** (same person, two hats). He accepts the invite
on the next screen.

#### What is passed to a contributor

Lea joins from the public page (open entry). She is a **member**. **Your space** shows the open
weekday-hall job and "you can be invited to work."

A week later Sam has a new ticket: **Find two neighbours who can cover a Saturday.** Recommended:
Lea (she joined, she said she can host). She is only a member, so Sam sees **Invite to contribute**
not Approve-and-send.

Lea gets **Sam is asking you to contribute on Stall.** The ticket is underneath, draft already
written: a short message she can send on the street chat, three names as placeholders.

She taps **Accept**. **What needs me?** now has one card:

> Find two neighbours who can cover a Saturday.
> Why you: you just joined and said you can host.
> Next: send this message, fill in two names.
> Approved by Sam.

She taps **Start**, edits the message, marks **Done**. Sam sees the ticket completed. Maya, as
Shaper, sees nothing — this was inside the Stall pot.

Maya still has **What needs a Shaper?** with one card: **Weekday hall — open, no steward.** No
tickets have been dumped on her.

---

### Example B — six weeks later, something has no owner

Saturday is running. The weekday hall is still open. A grower asks, in chat, "who signs the hall
licence?"

The AI creates a ticket: **Sign the weekday hall licence.** No mandate covers "licences." It does
**not** put this on Sam's stall queue and it does **not** put it on Maya's money queue.

#### What Shapers see

Maya opens **What needs a Shaper?** One new card:

> **Mandate needed: Hall licence / weekday hall**
> Attached ticket: Sign the weekday hall licence.
> Draft: domain Weekday hall · steward _open_ · pot 800 (hall deposit, from leftover grant) ·
> review 1 August · cosigner Maya (she asked for a second pair of eyes on money).
> Suggested steward: none of the members have done this. Lea said she can host — stretch.

Maya **amends**: steward Lea, pot 600 not 800, keeps herself as cosigner. **Offer to Lea.**

Lea gets **You are being asked to hold Weekday hall.** She **Declines** — "I can host a Saturday,
I cannot sign a licence." The card returns to Maya with that note. The ticket stays attached.

Maya offers the same mandate, no steward, **Keep open.** The public brief now shows "Weekday hall
needs someone who can sign a simple licence." A new neighbour, Rafi, requests to join and points
at that line. Maya accepts the join (she is a Shaper). He is a member.

She offers the mandate to Rafi. He **Accepts.**

#### What the new steward sees

Rafi's **What is waiting on me?**

- Pot: 600 / 600, review 1 August, cosigner Maya.
- Ticket: **Sign the weekday hall licence** — recommended: Rafi. Draft: the licence, the hall
  address, the date, a payment of 400 for the deposit.

He **Approves** (himself as contributor — invite + accept in one). He prepares the payment. Status:
**Waiting for release.**

#### What Maya sees as cosigner, and what a contributor would see

Maya's **What needs a Shaper?** now has **To release: 400 hall deposit, Weekday hall, Rafi.** She
**Releases.** Money moves.

If Rafi had picked a different member to collect keys, that member would have been invited as a
**Weekday hall contributor** and seen one card on **What needs me?** — collect keys, draft
already written. Sam would not see it. Stall contributors would not see it.

---

### Example C — North Workshop, who is who and who sees what

A bike-repair workshop. Five people. Read the cast first; then each moment is only a table of
screens.

#### Who is who

| Person  | Hats they hold                                         | Home they open first       | They do not see                          |
| ------- | ------------------------------------------------------ | -------------------------- | ---------------------------------------- |
| **Ana** | Founder, **Shaper** (not a steward, not a contributor) | **What needs a Shaper?**   | Tickets. Contributor queues.             |
| **Ben** | **Steward** of Workshop floor                          | **What is waiting on me?** | Shaper mandate cards. Other domains.     |
| **Cat** | **Contributor** on Workshop floor                      | **What needs me?**         | Green-light buttons. Pots. Memory diffs. |
| **Dan** | **Member** only                                        | **Your space**             | Any work queue.                          |
| **Eli** | **Investor** — put in 2,000, no hat                    | **Overview**               | Join as a member, tickets, green-lights. |

One mandate exists: **Workshop floor** — Ben — pot 1,500 — review 1 May — no cosigner.

Ana was offered Workshop floor at founding and **declined** ("I shape, I don't run the floor").
Ben accepted. Cat was invited by Ben after she joined. Dan joined yesterday. Eli has a link, not
a membership.

#### Moment 1 — Tuesday morning, nothing new

| Person | Their screen says                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| Ana    | **What needs a Shaper?** — "Nothing needs a Shaper." Secondary nav: pots (Workshop floor 1,100 left), memory. |
| Ben    | **What is waiting on me?** — 0 tickets. Pot 1,100 / 1,500.                                                    |
| Cat    | **What needs me?** — "Nothing needs you." One in-progress: "Label the loaner tools" (started Monday).         |
| Dan    | **Your space** — purpose, people, one line: "A steward can invite you to work." No queue.                     |
| Eli    | **Overview** — said / done / pots / changed. Watch: none yet.                                                 |

#### Moment 2 — a broken stand is reported

Someone writes in chat that the repair stand is unsafe. The AI creates a ticket: **Replace the
repair stand.** Recommended contributor: Cat. Steward: Ben.

| Person | Their screen now                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Ana    | **Unchanged.** This ticket has a steward. She gets no card.                                                               |
| Ben    | **What is waiting on me?** — 1 ticket: Replace the repair stand · recommended Cat · draft: buy stand, 180, from this pot. |
| Cat    | **Unchanged.** The ticket has not been green-lit. She must not see it yet.                                                |
| Dan    | **Unchanged.**                                                                                                            |
| Eli    | **Unchanged.** The payment has not happened.                                                                              |

Ben opens the ticket. He **Approves** Cat (already a contributor — no extra invite).

| Person | Their screen after Ben approves                                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ana    | Still nothing.                                                                                                                                                 |
| Ben    | Ticket left the waiting list. Pot still 1,100 (not paid yet).                                                                                                  |
| Cat    | **What needs me?** — one card on top: Replace the repair stand. Why you: you did the tool labels. Next: order this stand (link in the draft). Approved by Ben. |
| Dan    | Still **Your space**. He is not in this domain.                                                                                                                |
| Eli    | Still no payment to show.                                                                                                                                      |

Cat taps **Start**, orders, marks **Done**. Ben pays 180 from the pot. No cosigner, so it just
moves.

| Person | Their screen after it's done                                                                     |
| ------ | ------------------------------------------------------------------------------------------------ |
| Ana    | Still "Nothing needs a Shaper." She can open the ledger if she wants. She is not asked to sign.  |
| Ben    | Pot 920 / 1,500. Ticket completed.                                                               |
| Cat    | **What needs me?** — "Nothing needs you."                                                        |
| Dan    | **Your space.** Still no queue.                                                                  |
| Eli    | **Overview** — pot Workshop floor now 920. He can set a watch. He cannot approve the next stand. |

#### Moment 3 — Dan is interested; Ben invites him

Dan taps **I'm interested** on an open line on **Your space**: "evening shift needs a second pair
of hands." He is still only a member.

| Person | Their screen                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------- |
| Ana    | Nothing. Interest is not a Shaper decision.                                                              |
| Ben    | On that ticket: "Dan (member) said they are interested." Button: **Invite to contribute** — not Approve. |
| Cat    | Nothing. This is not her ticket.                                                                         |
| Dan    | **Your space** — "You said you were interested in evening shift." Waiting.                               |
| Eli    | Nothing.                                                                                                 |

Ben taps **Invite to contribute**. Dan gets **Ben is asking you to contribute on Workshop floor**,
with the evening-shift ticket underneath.

Dan **Accepts**.

| Person | Their screen                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------- |
| Dan    | **What needs me?** — first time this home exists for him. One card: evening shift, draft already written. |
| Ben    | Ticket left waiting; Dan is now a contributor _on Workshop floor only_.                                   |
| Cat    | Still "Nothing needs you." Dan's ticket is not on her list.                                               |
| Ana    | Still nothing. She did not make Dan a contributor.                                                        |
| Eli    | Nothing.                                                                                                  |

#### Moment 4 — a thing with no steward

A neighbour asks to borrow the workshop for a kids' Saturday. No mandate covers "lend the space."

| Person | Their screen                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Ana    | **What needs a Shaper?** — one card: **Mandate needed: Lending the space.** Attached ticket: kids' Saturday. Suggested steward: open. |
| Ben    | **Unchanged.** This is not Workshop floor (repairing bikes). It is not dumped on him.                                                 |
| Cat    | **Unchanged.**                                                                                                                        |
| Dan    | **Unchanged.**                                                                                                                        |
| Eli    | **Unchanged.**                                                                                                                        |

Ana offers the mandate to Ben. Ben **Declines** ("that's not the floor"). Card returns to Ana.
She leaves it **open**. The public brief now shows "Lending the space — needs someone." Dan does
not become that steward unless she **Offers** and he **Accepts**.

---

That is the whole point of the three homes: Ana never sees Cat's ticket. Cat never sees Ana's
mandate card. Dan has no queue until Ben invites him. Eli never gets a green-light button.

---

## What not to build

- One inbox that mixes join requests, tickets, payments, and memory diffs.
- Auto-assigning a member as contributor because the AI named them.
- Auto-assigning a steward. Offer, then accept.
- A contributor queue for people who have only joined.
- Shapers in the ticket approve button.

---

## Related

- [User Journeys — The Intelligent Organization](./user-journeys.md) — roles, decisions, funding
- [Organizational Intelligence — Architecture](../architecture/organizational-intelligence.md)
