# Hypha ↔ Matrix Domain Mapping

## Overview

Hypha uses Matrix as its real-time communication layer. The mapping between Hypha domain concepts and Matrix primitives is:

| Hypha Concept | Matrix Primitive | SDK Class | Notes |
|---|---|---|---|
| **Space** | Room | `matrix.Room` | 1:1 mapping. Each Hypha Space = exactly one Matrix Room |
| **Space members** | Room members | `matrix.RoomMember` | Membership synced via Matrix join/leave events |
| **Space chat** | Room timeline | `EventTimeline` | Messages sent directly to the room (not in a thread) |
| **Card / Signal** | Thread | `matrix.Thread` | Thread within the Space's Room. Root event ID stored in DB |
| **Card conversation** | Thread timeline | `EventTimeline` | Messages in the thread, scoped to that card/signal |
| **Message** | `m.room.message` event | `matrix.MatrixEvent` | Standard Matrix message event |
| **Reaction** | `m.reaction` annotation | `matrix.MatrixEvent` | `rel_type: "m.annotation"` on the target event |

## Why This Mapping

- **Spaces as Rooms** — A Room is Matrix's fundamental unit for membership, permissions, and message history. This maps naturally to Hypha's Space which is the fundamental organizing unit.
- **Cards as Threads** — Threads are scoped conversations within a Room. This allows viewing all card conversations in a Space together, or drilling into a single card's discussion.
- **Combined views** — Because threads live inside rooms, a Space-level view can show all activity (room messages + thread summaries), while a Card-level view shows only that thread's messages.

## SDK Reference

- Room: https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html
- Thread: https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Thread.html
- MatrixClient: https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html

## Version Constraint

Use `matrix-js-sdk@^40.0.0`. Version 41+ has a "Multiple entrypoints detected" runtime crash in Next.js/Turbopack.
