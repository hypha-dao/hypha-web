---
title: 'Intelligent Organization — Screens'
date: 2026-08-24
status: draft
tags: [product, intelligent-org, ui]
---

# Intelligent Organization — Screens

What each screen is for, who it is for, and what happens there. Companion to
[The Intelligent Organization](./intelligent-org.md).

Homes do not mix. If you hold more than one type, you switch. You never see every queue in one
list.

---

## Who opens what when they log in

**First time in the app** — no profile yet — they always open **Chat** (**Create profile**).
Not a space home.

After that, the home is the screen they land on for **this** space. If they belong to several
spaces, they pick a space first, then that space’s home.

| Who                    | Home they open                                              |
| ---------------------- | ----------------------------------------------------------- |
| **New person**         | **Create profile** (Chat)                                   |
| **Potential member**   | **Find work** if they are still looking; **Public space** if they already picked a space |
| **Member**             | **The space**                                               |
| **DRI** (ticket)       | **What needs me?**                                          |
| **DRI** (mandate)      | **What I hold**                                             |
| **Shaper**             | **What needs a Shaper?**                                    |
| **Investor**           | **Overview**                                                |
| **Founder**            | **Create space** while they are setting up. After that, same as whatever they became (usually Shaper). |

If they are more than one of these, they open the **last home they used**, with a switch to the
others. A new Shaper who is also a mandate DRI does not land on a mixed inbox.

**Chats** sit beside every home — 1:1, groups, and the org agent. After the first login, this
is where people actually spend the day. The home above is what they land on so they know what
needs them. It is not a replacement for talking.

---

## Which screen is for whom

| Screen                  | New person | Potential member | Member | DRI | Shaper | Investor | Founder |
| ----------------------- | ---------- | ---------------- | ------ | --- | ------ | -------- | ------- |
| **Create profile**      | home       | —                | —      | —   | —      | —        | —       |
| **Find work**           | after join | home if looking  | —      | —   | —      | —        | —       |
| **Public space**        | —          | if they picked one | —    | —   | —      | can look | —       |
| **Request sent**        | —          | if gated         | —      | —   | —      | —        | —       |
| **The space**           | —          | —                | home   | —   | —      | —        | after, if they took no hat |
| **What needs a Shaper?**| —          | —                | —      | —   | home   | —        | —       |
| **What I hold**         | —          | —                | —      | mandate home | — | —     | —       |
| **What needs me?**      | —          | —                | —      | ticket home  | — | —     | —       |
| **Offer**               | —          | —                | when asked | when asked | — | —  | —       |
| **Ticket**              | —          | —                | —      | yes | —      | —        | —       |
| **Pot**                 | —          | —                | can look | yes | yes    | can look | —       |
| **Overview**            | —          | —                | can look | can look | can look | home | —    |
| **Chats**               | profile    | find work        | always | always | always | ask only | **Create space** |
| **Thread**              | profile    | find work        | yes    | yes    | yes    | ask only | **Create space** |
| **Create space**        | if create  | —                | —      | —   | —      | —        | home while founding |

“Can look” means they may open it. It is not the screen they land on.

---

## Create profile

**Who:** new person — first login, no profile yet. This is their home until they confirm.

**For:** making the person, then choosing join or create.

**What happens:** Chat, full width. The AI asks whether they want to **join an org** or **create
one** (this may be first). Then who they are. They can drop social links or just usernames, and
any other context. A profile card fills in the side. They confirm. No form.

- **Create** → same chat becomes **Create space**.
- **Join** → same chat asks what kind of org they want, then becomes **Find work**.

---

## Find work

**Who:** potential member who said they want to join — their home while they are still looking.

**For:** seeing open jobs that fit them.

**What happens:** still Chat. The AI asks about the org (purpose, place, the work they like).
Then it shows open tickets and mandates with no DRI, matched to their profile and those
answers. They pick one. That opens **Public space** with that job pinned. Join or request as
usual — picking a job is interest, not an assignment.

---

## Chats

**Who:** everyone in the space. New person, potential member, and founder use an **agent**
thread first (profile, find work, create space). Investor may read and ask; they cannot create
work.

**For:** the main surface of the app — people, the org agent, and the project in one place.

**What happens:** a list of threads. **People:** 1:1 and groups. **Agent:** talk to the org to
create a profile, a space, a ticket, a mandate, or a payment. Opening a thread is the next
screen. There is no separate chat product.

Every people thread is fed to the org as it happens. The agent drafts tickets and mandates from
that, plus mail and calls. Members do not copy a conversation into a form.

---

## Thread

**Who:** whoever is in that 1:1, group, or agent conversation.

**For:** talking — to a person, a group, or the org.

**What happens:** messages in one thread. In an agent thread, cards appear in the side and
someone confirms. In a people thread, they just talk. If the org hears a need, a draft card
lands on the right home (Shaper or mandate DRI), not as a popup that hijacks the conversation.

---

## Public space

**Who:** potential member (their home). Anyone not in the space, including an investor who was
sent a link.

**For:** deciding if this space is real — and, if they are looking for work, seeing what is
still open.

**What happens:** they read what this is, what it has done, and open jobs (tickets and mandates
with no DRI). They can point at one job. If they arrived from **Find work**, that job is already
pinned. They tap **Join**, or **Request to join** if entry is gated.

---

## Request sent

**Who:** potential member, only when entry is gated.

**For:** waiting after they asked to join.

**What happens:** they see that the request went through. They cannot see member screens. A
Shaper gets the request on their home. One accept lets them in — they become a **member**.

---

## The space

**Who:** member (their home).

**For:** being in the space without yet holding work.

**What happens:** they see purpose, who is here, and open jobs. If they have an offer, it sits
here. They have no work queue. **Chats** are right there — they can talk in 1:1s and groups
from the first day. Talking is how they show up, not a privilege of being a DRI.

---

## What needs a Shaper?

**Who:** Shaper (their home).

**For:** the next structural thing.

**What happens:** one list of cards the AI (or a person) drafted: mandates to confirm, join
requests, memory to write or retire, pots to fill, payments waiting for their cosign, review
dates. They open a card, amend if they want, and confirm or reject. Empty says *Nothing needs a
Shaper.* They do not see tickets.

---

## Offer

**Who:** member or DRI being asked. A potential member does not get this until they have joined.

**For:** saying yes or no to a job or a piece of work.

**What happens:** one screen for both. A mandate shows the job, the pot, the three taps, and the
review date. A ticket shows the draft, why them, and the bounty if any. They **Accept** or
**Decline**. Decline sends it back. Nobody is assigned.

---

## What I hold

**Who:** mandate DRI (their home).

**For:** the job they said yes to.

**What happens:** they see pot left, standing pay still to land, tickets waiting, expenses
already spent, and any child mandates. They open chat to add work or spend. They can put the
mandate down. Tickets they should *do* are not on this list — those are on **What needs me?**

---

## What needs me?

**Who:** ticket DRI (their home).

**For:** the next piece of work.

**What happens:** one card on top, or *Nothing needs you.* They open it. They do not see
mandates, pots, or other people’s tickets.

---

## Ticket

**Who:** ticket DRI.

**For:** doing one piece of work.

**What happens:** the draft is already written — why this, why you. They **Start**, edit, mark
**Done**, or **Decline** (_not my thing_ / _no room right now_). Done pays if the ticket had a
bounty. Putting it down sends it back under the mandate.

---

## Pot

**Who:** mandate DRI (to spend). Shaper (to fill or resize). Member and investor may look.

**For:** seeing the money on a mandate.

**What happens:** remaining / total, how it splits (standing / ticket / expense), the ledger,
child mandates under the parent. A new expense is confirmed in chat. If the pot has a cosigner,
a payment shows *waiting* until they release or refuse it from their home.

---

## Overview

**Who:** investor (their home). Anyone else may look; it is not a work screen.

**For:** seeing what the space said, what it did, and how the pots moved — without running it.

**What happens:** what we said, what we did, the pots, what changed. Bad news first if there is
any. They can set a watch. No accept, no spend, no work buttons.

---

## Create space

**Who:** founder, once.

**For:** starting an organization.

**What happens:** this is Chat, full width. The AI asks what this is for, who is here, the next
90 days, and how money works. Cards fill as they talk (memory, Shapers, first mandates, who can
join). They review and confirm. Then they log into **What needs a Shaper?** if they took that
role, or **The space** if they did not.
