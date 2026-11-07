---
title: 'Intelligent Org — Buzz additions'
date: 2026-08-26
status: draft
tags: [product, intelligent-org, buzz]
---

# Intelligent Org — Buzz additions

What we would add if we fork Buzz. Six features. Same rule as the rest of this work: the AI drafts, people confirm — except where talk already made the outcome obvious.

In Buzz, a new feature is a new event `kind`. The relay already stores it, fans it out, indexes it, and can trigger a workflow. We do not add a second database for work.

---

## Where it sits

```
People and calls
    → signed events (chat, files, transcripts)
        → relay (already there)
            → org agent (new listener)
                → draft mandate or ticket (new kinds)
                    → only the right person can make it real
```

**Reuse:** channels, media uploads, search, `buzz-acp` (agent in a room), workflow triggers on every stored event.

**Add:** a few custom kinds (`40000+`), an org agent that is a member of every channel, call → transcript events (huddles today have audio, not a written log), **My Work**, **All Work**, and **Org** tabs next to Inbox and Agents.

**Do not use YAML workflows for the thinking.** Workflows are good for “when this event, do that.” Drafting a mandate from a conversation needs the org agent.

---

## 1. Shapers chat

Not a one-time founding interview. **`#shapers`** is the standing room for direction — what the org is, what we are aiming at, what has changed. The org agent lives here. Shapers keep talking to it. The brief and objectives stay current because this chat never closes.

Call it **Shapers**, not Founding. Founding is day one of this room, not the name of the room.

When the community is created, the founder is the first Shaper and lands here with the org agent. They talk, drop files and links. The agent reads them. Together they write the first brief: purpose, who this is for, what “good” looks like soon.

The founder invites people they trust **into this channel**. That is how you become a Shaper — you are asked into `#shapers`, you accept. They can then write here too. The agent treats all of them as authors of the brief.

**Day one does not create projects.** First brief, then invite other Shapers (and later, members). Projects when a Shaper asks, or when there is enough talk to make one real.

Later, any Shaper can say “we now care about X” or drop a new doc. The agent drafts an update to the brief. A Shaper confirms. Same loop, forever.

**In Buzz:** on community create, open `#shapers` (private), add the org agent, add the founder. Membership of this channel *is* the Shaper list — no extra role table. Invite = offer Shaper; leave or remove = they stop being one. The brief is a replaceable event. New versions come from this channel only. Until a Shaper confirms, an update is a draft. Org and All Work read the latest confirmed brief.

---

## 2. Talk becomes work

All via chat. You write. The agent drafts. There is no “new ticket” button.

Anyone’s talk is **context**. Only some people can make it **work**. Hearing a need is not the same as funding a project or putting a ticket on someone’s list.

| What | Who can make it real | Date it carries | Why |
| --- | --- | --- | --- |
| **Mandate / project** | A **Shaper** | **Review date** — when Shapers look again | They fund it. A new job spends the org’s attention and pot. |
| **Ticket** | The **mandate DRI** | **Estimated completion** — when this piece should be done | It spends *their* job. They create it for themselves, or offer it to someone on their team. |

Every live mandate has a review date. Every live ticket has an estimated completion. The agent can draft both from talk (“by Saturday”, “look again in June”). The person who authorizes the card sets or confirms the date. No date, not real yet.

A member saying “we should fix the hall licence” does not create a project. The agent drafts a card and puts it in front of a Shaper. If a Stall mandate already covers it, the card goes to Sam (that DRI) as a ticket draft — not to Shapers.

If Sam writes “I’ll find two Saturday covers” or “Lea, can you take covers?” — that is a ticket under Stall. He just said it in the channel. The agent drafts it. Sam confirms (or it is already his intent). Lea sees an offer; she accepts or declines.

So three doors, still chat:

1. **Hear** — org agent reads every channel and transcript. Picky: not every message is work. Same gap twice = one card.
2. **Authorize** — Shaper confirms a mandate (pot + review date). Mandate DRI confirms a ticket (self or teammate, + estimated completion).
3. **Accept** — the named person says yes. Nobody is assigned.

The Shaper does not mint tickets inside someone else’s mandate. The DRI does not mint a new funded project. If the DRI needs something their pot does not cover, that goes back to Shapers as a mandate draft.

**In Buzz:** same as before — agent in the rooms, draft kinds tagged to the source messages. The picky part is routing: a draft carries `needs: shaper` or `needs: mandate-dri <pubkey>`. Only that pubkey’s confirm event (or a reply in the thread) promotes the draft. Everyone else can talk; they cannot stamp it live. Review date and estimated completion live on the event (`review_at`, `due_at`). My Work and All Work just read those fields.

---

## 3. Talk moves work

If someone says in a channel or on a call that a ticket is done, and that is in the transcript, the ticket becomes done.

The agent posts the receipt: which line, which call. The DRI can reopen. No silent state.

Same for other obvious moves later (someone took it, someone dropped it). Start with **done**.

**In Buzz:** tickets are replaceable events with a state. The same org agent that drafts work also watches for outcomes. A “done” writes a new version of the ticket and links the evidence event. That is the closed loop: hear → draft → act → remember.

---

## 4. My Work tab

Beside **Inbox** and **Agents**, a third tab: **My Work**. This is the person’s work home — not the org’s, not the Shaper queue.

It shows three things, in one place:

1. **Mandates / projects I hold** — I accepted the job. Review date on the card.
2. **Tickets I accepted** — I am doing these. Estimated completion on the card.
3. **Tickets I can accept** — offered to me, not yet yes or no. Estimate shown before they say yes.

Empty says *Nothing needs you.* Opening a card is accept / decline / open the work. Done tickets leave this list.

This is not Buzz’s existing **Projects** tab (that is git). My Work is only mandates and tickets tagged to *this* pubkey.

**In Buzz:** a new sidebar item and route, same shell as Inbox and Agents. The view is a filter over the mandate and ticket events we already store: `DRI = me`, or `offered to me` and still open. No extra store. A badge counts open offers. Accept and decline are the same events as in chat — this tab is another door onto the same log.

---

## 5. All Work tab

Beside My Work: **All Work**. This is the org’s board — who is working on what. Not a queue. You look; you do not accept from here unless you open a card that is already yours.

It lists:

- **Every mandate / project** — who the DRI is, or *open*, and the **review date**.
- **Every ticket under them** — who accepted it, or *offered / unassigned*, and the **estimated completion**.

That is the overview. Sam holds Stall. Lea has the Saturday covers ticket. Weekday hall has no DRI yet. One screen, the whole org.

My Work is *what I hold and what I can take.* All Work is *what exists.* Drafts waiting on a Shaper or a mandate DRI do not belong here until they are real.

**In Buzz:** same shell, second route. Same events as My Work, unfiltered by pubkey — group by mandate, show DRI on each row. No extra store. This is not Buzz Projects (git). Anyone in the community can open it.

---

## 6. Org tab

Beside My Work and All Work: **Org**. This is who we are, not what is in flight.

It shows:

- **What this org is about** — the latest confirmed brief from `#shapers`.
- **Established** — when the community was created.
- **Founder** — who created it. Still a Shaper unless they left.
- **Shapers** — who is in `#shapers` now. These people set direction and fund mandates.
- **Members** — who is here now.
- **Mandate DRIs** — who currently holds a job. Name + mandate. Open mandates with no DRI still list as *open*.

All Work is *who is working on what.* Org is *who we are, who shapes, who holds the jobs.* No tickets here. No accept buttons.

**In Buzz:** a third route in the same sidebar. The brief is the replaceable event from `#shapers`. Founder and established date are on the community record. Shapers = members of that channel. Members are the existing roster. Mandate DRIs are a filter on live mandate events. Nothing new to store.

---

## Order

1. `#shapers` + first brief.  
2. Org agent on all chats; drafts only.  
3. My Work, All Work, and Org tabs.  
4. Call transcripts.  
5. Done-from-talk.

Money stays on Hypha. This fork only adds memory, work objects, and the agent that writes them into the same log people already talk in.
