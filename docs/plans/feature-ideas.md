---
title: 'Feature Ideas'
date: 2026-10-14
status: draft
tags: [roadmap, feature-ideas, product]
---

# Feature Ideas

One place to collect potential **new features** and **improvements to existing features** for the Hypha platform. This is a backlog of ideas, not a commitment or a roadmap: an idea listed here has not been scoped, prioritised, or approved.

When an idea is picked up, open a GitHub issue for it, link the issue in the idea's row, and move detailed design into `docs/requirements/` or `docs/plans/`.

---

## How to add an idea

Add a row to the table for the right area under [New features](#new-features) or [Improvements to existing features](#improvements-to-existing-features). Keep each row short and use the columns below.

| Column  | What to write                                        |
| ------- | ---------------------------------------------------- |
| Idea    | A short name for the feature or change               |
| Problem | Who it helps and what is hard or impossible today    |
| Notes   | Rough approach, affected packages, open questions    |
| Status  | One of the values in [Status values](#status-values) |
| Link    | GitHub issue, PR, or spec, or `—` if none exists yet |

### Status values

| Status      | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| `idea`      | Captured only; nobody has looked into it yet             |
| `exploring` | Someone is researching it (analysis issue or spike open) |
| `planned`   | Scoped with an issue or spec and waiting to be built     |
| `building`  | Implementation in progress                               |
| `shipped`   | Released; keep the row briefly, then remove it           |
| `dropped`   | Decided against; leave a one-line reason in Notes        |

---

## New features

### Governance and spaces

| Idea                       | Problem                                                                            | Notes                                                                                       | Status      | Link                                                        |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| Space calendar feed        | Members miss space events because they live only inside Hypha                      | Publish an iCal feed per space so events show up in Google Calendar and other apps          | `exploring` | [#2548](https://github.com/hypha-dao/hypha-web/issues/2548) |
| Proposal templates         | Members recreate common proposals (pay expense, add member) from scratch each time | Save and reuse prefilled proposal drafts per space, built on the existing agreement plugins | `idea`      | —                                                           |
| Delegated voting           | Members who cannot follow every proposal lose their voice                          | Let a member delegate voting power to another member, per space; needs contract support     | `idea`      | —                                                           |
| Proposal outcome summaries | After a vote closes it is hard to see what changed and why                         | Auto-generate a short summary of the discussion, vote result, and executed actions          | `idea`      | —                                                           |

### Treasury and banking

| Idea                             | Problem                                                                    | Notes                                                                                      | Status      | Link                                                        |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------- |
| Card ordering and PDF statements | Spaces with banking cannot order cards or download statements in the app   | Add a card-ordering call to action and PDF bank statement download                         | `planned`   | [#2291](https://github.com/hypha-dao/hypha-web/issues/2291) |
| AUDD stablecoin on- and off-ramp | Australian spaces have no native fiat path                                 | AUDD Gateway onboarding and KYC, following the Bridge integration pattern                  | `planned`   | [#2474](https://github.com/hypha-dao/hypha-web/issues/2474) |
| Payment links and QR codes       | Sharing deposit and transfer instructions is manual and error-prone        | Generate a payment link or QR code for deposit and transfer instructions                   | `exploring` | [#2301](https://github.com/hypha-dao/hypha-web/issues/2301) |
| Treasury reports                 | Members and funders want a periodic view of income, spending, and balances | Monthly report per space, exportable as CSV or PDF, built from transfers and on-chain data | `idea`      | —                                                           |

### Chat, calls, and coherence

| Idea                        | Problem                                                                               | Notes                                                                               | Status      | Link                                                        |
| --------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| In-app notification centre  | Coherence notifications only arrive by push or email                                  | Notification centre UI inside the web app                                           | `planned`   | [#2498](https://github.com/hypha-dao/hypha-web/issues/2498) |
| In-call chat                | People on a call cannot see or post to the space chat without leaving the call window | Show the space chat inside the call window                                          | `exploring` | [#2529](https://github.com/hypha-dao/hypha-web/issues/2529) |
| Call transcripts by default | Decisions made on calls are lost unless someone takes notes                           | Space-level preference to transcribe calls by default and save them to Space Memory | `planned`   | [#2523](https://github.com/hypha-dao/hypha-web/issues/2523) |
| Guest access to calls       | Inviting an outside guest to a call requires them to create a Hypha account           | Time-limited guest links for video calls                                            | `exploring` | [#2416](https://github.com/hypha-dao/hypha-web/issues/2416) |

### AI and integrations

| Idea                              | Problem                                                                             | Notes                                                                                           | Status      | Link                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Integration API for external apps | External clients cannot perform platform operations on behalf of users              | Client identity plus scoped platform operations                                                 | `building`  | [#2515](https://github.com/hypha-dao/hypha-web/issues/2515), [#2534](https://github.com/hypha-dao/hypha-web/issues/2534) |
| Integration kit for AI agents     | Teams building on Hypha have no ready-made playbooks or context for their AI tools  | Playbooks plus MCP context for taking a project to a Hypha integration                          | `planned`   | [#2546](https://github.com/hypha-dao/hypha-web/issues/2546), [#2517](https://github.com/hypha-dao/hypha-web/issues/2517) |
| Agent discoverability             | External AI agents cannot easily find what Hypha offers or how to call it           | Publish an `integrations.md` and improve agent-facing discoverability                           | `exploring` | [#2522](https://github.com/hypha-dao/hypha-web/issues/2522)                                                              |
| Assistant write actions           | Hypha AI can read space data but cannot draft proposals or discussions for the user | Let the assistant prepare drafts that the user reviews and submits; gated behind a feature flag | `idea`      | —                                                                                                                        |

---

## Improvements to existing features

| Area          | Idea                                     | Problem                                                                     | Notes                                                              | Status    | Link                                                               |
| ------------- | ---------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------- | ------------------------------------------------------------------ |
| Notifications | Per-type notification preferences        | Users can only turn notifications on or off broadly                         | In-code templates and per-type preferences                         | `planned` | [#2549](https://github.com/hypha-dao/hypha-web/issues/2549)        |
| Notifications | Accurate preference toggles              | The notification centre shows unset preferences as enabled                  | Show the real unset state                                          | `planned` | [#2508](https://github.com/hypha-dao/hypha-web/issues/2508)        |
| Banking       | Direct "Payout Details" action           | Off-ramp transfers require copying a web3 address by hand                   | One-click action from the payout screen                            | `planned` | [#2468](https://github.com/hypha-dao/hypha-web/issues/2468)        |
| Banking       | Address autocomplete and list pagination | Banking lists are slow to fill in and do not paginate                       | Address autocomplete plus paginated lists                          | `planned` | [#2330](https://github.com/hypha-dao/hypha-web/issues/2330)        |
| Wallet        | Show partial-failure state in token list | The wallet token list silently shrinks when one upstream asset source fails | Show a warning and keep cached results instead of dropping tokens  | `idea`    | [#2455](https://github.com/hypha-dao/hypha-web/issues/2455)        |
| Calls         | Screenshare quality controls             | Screenshares can be blurry and there is no zoom or picture-in-picture       | Manual quality controls plus zoom and PiP                          | `planned` | [#2427](https://github.com/hypha-dao/hypha-web/issues/2427)        |
| Calls         | Less intrusive call invitations          | A full-screen modal interrupts users already in the room                    | Replace with a lighter in-room prompt                              | `planned` | [#2430](https://github.com/hypha-dao/hypha-web/issues/2430)        |
| Mobile        | Vote from mobile                         | Members cannot vote on proposals from the mobile app                        | Governance vote through a Privy server SDK proxy                   | `planned` | [#2351](https://github.com/hypha-dao/hypha-web/issues/2351)        |
| Mobile        | Responsive panels and header             | Side panels and the header are hard to use on small screens                 | See the existing spec                                              | `planned` | [Spec](../requirements/mobile-responsive-panel-and-header-spec.md) |
| Onboarding    | Contributor onboarding guide             | New contributors struggle with dev setup, env vars, and platform gotchas    | Improve the dev setup guide and fill env var gaps                  | `planned` | [#2293](https://github.com/hypha-dao/hypha-web/issues/2293)        |
| Documentation | Keep docs in sync with code              | Docs and code have drifted, per the functionality inventory                 | Reconcile the drift, then add a lightweight check during PR review | `planned` | [#2520](https://github.com/hypha-dao/hypha-web/issues/2520)        |

---

## Related documents

- [Documentation Hub](../index.md)
- [Requirements](../requirements/)
- [Plans](./)
