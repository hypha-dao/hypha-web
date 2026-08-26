---
title: 'User Journeys — DRI'
date: 2026-08-24
status: draft
tags: [product, journeys, dri, intelligent-org]
---

# User Journeys — DRI

How a Hypha space works when there are only **members**, **DRIs**, and **Shapers**.

The longer [product brief](./user-journeys.md) and [UI flows](./user-journeys-ux.md) still use
steward and contributor. This file is the simpler model. Use this one when the question is “who
owns this, and how do they get paid?”

---

## Who is who

| Role        | What they are                                                              |
| ----------- | -------------------------------------------------------------------------- |
| **Member**  | They joined. They have no job until they say yes to a mandate or a ticket. |
| **DRI**     | They said yes. They own that mandate, or that ticket, until they put it down. |
| **Shaper**  | They decide what the space believes, who else is a Shaper, which mandates exist, and how big each pot is. |

Founder is setup only. After the first day they are a member, usually also a Shaper.

A DRI is not a class of person. It is a relationship to a thing. Sam can be DRI of the stall
mandate and DRI of one ticket on it. Lea can be DRI of a ticket and nothing else.

---

## A mandate

A mandate is one job:

- **what** — the domain (Stall, Money, Weekday hall)
- **who** — the DRI, once someone accepts
- **pot** — the money for this job (can be 0)
- **review** — the date Shapers look again

Shapers offer a mandate. The person accepts or declines. Nobody is assigned.

---

## The pot has three taps

One pot per mandate. Shapers fill it. They do not sign every payment. Money leaves in only three
ways:

| Tap               | What it is                                                         | When it pays                         |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------ |
| **Standing pay**  | A named person, an amount, every month, until the review date      | On the cadence. No extra approve.    |
| **Ticket pay**    | A bounty on one piece of work                                      | When that ticket is marked done.     |
| **Expense**       | A thing the job needs — hall, ice, a fridge, a stand               | When the mandate DRI spends it.      |

Standing pay is how someone plans a month. Ticket pay is how you recruit a piece of work. Expense
is everything that is not a person getting paid for a job.

All three come out of the **same** pot. When the mandate ends or the pot is resized, the taps
stop. Salary is never attached to a person with no job.

If a pot has a **cosigner**, an expense or a ticket payment can wait for their release. Standing
pay is already in the mandate Shapers approved — it just runs.

---

## How work moves

1. A Shaper offers a mandate. Someone accepts. They are the **mandate DRI**.
2. A need appears. The AI drafts a ticket under that mandate (or files a new mandate if nothing
   covers it).
3. The mandate DRI offers the ticket to a member — or takes it themselves. That person accepts.
   They are the **ticket DRI**.
4. They do the work. If the ticket had ticket pay, they get paid when it is done. Expenses the
   mandate DRI spends from the pot. Standing pay just lands.

A member with no DRI relationship sees the space, not a work queue.

---

## Example — Maya starts from a Shaper card

Maya is a Shaper of **River Commons**, a street food hub. Saturday already works because Sam runs
the stall. She has a 4,200 grant. She is not inventing jobs. She is putting money on the jobs
that already exist.

### 1. She offers the Stall mandate

On **What needs a Shaper?** she opens a mandate card and fills it in:

> **Stall**
> DRI: Sam
> Review: 1 June
> Pot: **1,200**
>
> How the pot splits:
>
> - **Standing pay** — Sam, 400 a month, until 1 June
> - **Ticket pay** — 150, on “Find two neighbours who can cover a Saturday”
> - **Expense** — the rest (~250) for ice, a table, small kit

She taps **Offer to Sam**.

Sam is not assigned. He gets a clear screen: the job, the pot, the three taps, the review date.
He taps **Accept**. He is now DRI of Stall.

Maya does not see stall tickets after this. She filled the pot. Sam spends it.

### 2. Standing pay just runs

1 May: **400** goes to Sam. Nobody taps approve. The pot shows **800** left.

That is the line that lets Sam treat Saturday as a job, not a gift.

### 3. Ticket pay recruits Lea

The ticket **Find two neighbours who can cover a Saturday** already sits on the mandate, with
**150 ticket pay**.

Sam offers it to Lea. She is only a member. She sees the ticket and the 150. She taps **Accept**.
She is DRI of that ticket — not of the stall.

She sends the message, writes two names, marks **Done**. **150** pays her from the Stall pot.
Pot left: **650**.

Maya is not asked. Sam does not re-approve the payment. The bounty was already on the ticket.

### 4. Expense is the ice

Saturday is hot. Sam spends **40** on ice. That is an **expense**. Pot left: **610**.

If Maya had marked herself as cosigner on this pot, the 40 would wait for her **Release**. She
did not. It just moves.

### 5. Something has no DRI

A grower asks who signs the weekday hall licence. No mandate covers that.

It does **not** land on Sam. Maya’s **What needs a Shaper?** gets a new card: **Weekday hall —
no DRI yet**, ticket attached, draft pot 600.

She offers it to Lea. Lea declines (“I can host a Saturday, I cannot sign a licence”). The card
comes back. Maya leaves it open. The public page now says the hub needs someone who can sign a
simple licence.

That is the whole loop: Shaper creates the job and the pot, a DRI takes the job, money leaves
through standing pay, ticket pay, or expense, and anything with no DRI goes back to Shapers.

---

## What you should be able to see in one glance

**Shaper:** which mandates have a DRI, which are open, how full each pot is, and the split they
approved (standing / ticket / expense).

**Mandate DRI:** the pot left, standing pay that will land, tickets still open, expenses already
spent.

**Ticket DRI:** one ticket, what “done” looks like, and whether it pays.

**Member:** the space, and any offer sitting there. No queue.

---

## What not to do

- Pay a person with no mandate. That is a slush fund.
- Pay only per ticket if someone is meant to hold a domain. Holding is not ticket-shaped.
- Make Shapers sign every payday.
- Give someone a DRI queue because they joined.
- Add extra roles for “the person who does the work” or “the person who coaches.” Those are
  tickets and duties inside a mandate, not hats.

---

## Related

- [User Journeys — The Intelligent Organization](./user-journeys.md) — longer product brief
- [User Journeys — UI and flows](./user-journeys-ux.md) — screen-by-screen (steward / contributor)
- [Organizational Intelligence — Architecture](../architecture/organizational-intelligence.md)
