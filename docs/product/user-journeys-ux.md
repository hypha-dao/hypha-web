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
