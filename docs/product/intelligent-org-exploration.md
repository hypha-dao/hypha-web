---
title: 'Intelligent Org — Exploration'
date: 2026-08-26
status: draft
tags: [product, intelligent-org]
---

# Intelligent Org — Exploration

A short note on what we are trying to build, and which foundation to use.

---

## The question

**What does it mean for an organization to be intelligent?**

It can say what each person should do next — or at least suggest it, so they can choose.

The AI drafts. People decide. Nobody is forced.

---

## Two stakeholders

| Who | Job |
| --- | --- |
| **Shaper** | Sets objectives. Holds short-term and long-term strategy. |
| **DRI** | Owns a piece of work they accepted. Does it. |

A DRI is a relationship to a job, not a title. Joining the org does not make you a DRI.

---

## The loop

```
Shaper sets direction
        ↓
AI suggests projects
        ↓
Shaper approves a project, names a DRI, sets a budget
        ↓
AI creates tickets for that project, and suggests other DRIs
        ↓
People accept or decline
```

That is the product. Chat is how the org hears what is happening. Work cards are how it answers.

---

## The fork

This loop needs a place to live. Two routes.

**A — Buzz.** Use Buzz as the base: rooms, people, agents, and this work loop on top.

**B — Hypha.** Keep building in the Hypha web app, and redesign it until it can run this loop.

---

## Route A — Buzz

**Pros**

- Built for people and agents in the same room. That is the surface this product needs.
- Every action is a signed event. Suggestions, approvals, and agent drafts share one log.
- Chat is the product, not a side panel.
- Agents already have their own identity. An org agent is just another member.
- Fast way to test the loop with real conversation.

**Cons**

- Young product. Not finished. Not ours.
- No Hypha spaces, treasury, tokens, or on-chain governance.
- No mandate / pot / payment model. We would still have to build the work objects.
- Our users and our money live in Hypha today.
- Identity is a Nostr key, not a Hypha wallet. Two worlds to join later.

---

## Route B — Hypha

**Pros**

- We own it. Spaces, members, treasury, and proposals already exist.
- Money is the hard part of an org. Hypha already moves it.
- Existing users stay in one app.
- Memory and governance work we already started can stay in-repo.

**Cons**

- The app was not designed for this. Tabs, forms, and asides — not a chat that drafts work.
- Doing it properly is a redesign, not a feature.
- No native “agent as a member.” We would build that from scratch.
- Slow path to learning if the loop is even right.

---

## Choice

**Start on Buzz. Keep Hypha for money and membership.**

The intelligent-org idea is a conversation that puts the next action in front of the right person. Buzz already is that room. Hypha is a governance console. Building the room inside the console is a rewrite that still looks like the old app.

What I would do:

1. Run the Shaper → project → DRI → ticket loop on Buzz, in one community, with an org agent in the channel.
2. Leave pots, payments, and on-chain decisions on Hypha.
3. Join the two only after the loop is real — Shaper approved a project in Buzz, pot lives in Hypha.

Do not migrate Hypha into Buzz. Do not pretend Hypha is already an intelligent org. Test the idea where people and agents already sit together. Keep the money where it already works.
