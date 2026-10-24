# Matrix room types (`io.hypha.room.*`)

Hypha writes an immutable room kind into `m.room.create`
(`creation_content.type`) when the **Application Service bot** creates a
room. Clients read it with `room.getType()`. Kind is **not** inferred from
member count.

This table is the Messages-list contract after [#2568](https://github.com/hypha-dao/hypha-web/pull/2568)
and [#2569](https://github.com/hypha-dao/hypha-web/pull/2569). It does not
change how rooms are created.

Constants live in [`packages/core/src/matrix/room-types.ts`](../../packages/core/src/matrix/room-types.ts).

## Types

| `room.getType()` | Constant | What the bot created | Messages list | Messages unread badge |
|---|---|---|---|---|
| `io.hypha.room.dm` | `HYPHA_ROOM_TYPES.dm` | Private 1:1, aliased `hypha-dm-<env>-<hash>` | Person row, even when the other person shares no space | Counted |
| `io.hypha.room.group` | `HYPHA_ROOM_TYPES.group` | Private group started from Messages | Group row (hidden once archived) | Counted while listed |
| `io.hypha.room.signal` | `HYPHA_ROOM_TYPES.signal` | One signal thread (`coherences.room_id`) | Out | Out |
| `io.hypha.room.proposal` | `HYPHA_ROOM_TYPES.proposal` | One proposal discussion (`documents.chat_room_id`) | Out | Out |
| `io.hypha.room.space` | `HYPHA_ROOM_TYPES.space` | Members-only space room (`spaces.chat_room_id`) | Out | Out |
| `io.hypha.room.space-public` | `HYPHA_ROOM_TYPES.spacePublic` | Public space room (`hypha-public-<slug>`) | Out | Out |
| `io.hypha.room.network` | `HYPHA_ROOM_TYPES.network` | Network-wide room (`hypha-network`) | Out | Out |
| `io.hypha.room.ecosystem` | `HYPHA_ROOM_TYPES.ecosystem` | Ecosystem root (`hypha-ecosystem-<slug>`) | Out | Out |
| *(empty / legacy)* | — | Rooms created before typed creation | Never a person row. A group row only when listing heuristics still match a remembered or comma-titled 3+ human room ([#2569](https://github.com/hypha-dao/hypha-web/pull/2569)) | Only if that group row is visible on Messages |

## Messages rules

1. **Person rows are built from DM-typed rooms**, then enriched with a Hypha
   profile when the other Matrix id is in the directory. A DM from someone who
   shares no space still appears.
2. **Legacy untyped 1:1 rooms are hidden.** They are not DMs — including
   leftovers that still have an `m.room.name` (often a raw Privy id) or a
   stale/odd type. An untyped 2-person room whose peer already appears via a
   typed DM stays out of Messages and the new-group picker. Their unread and
   @-mentions must not raise the Messages badge or invent a person row
   (“phantom mentions”).
3. **The unread badge sums the same rows Messages shows** (search ignored).
   Archived groups are listed under Archived only and do not increment the
   badge.
4. **Room kind comes from `room.getType()`**, not from how many humans joined.
   Two people in a space or signal room is not a DM.

## Out of scope here

- Creating or retyping rooms (bot / Application Service).
- Server-side notification classification ([#2567](https://github.com/hypha-dao/hypha-web/issues/2567)).
- Messages vs the right-hand chat panel ([#2570](https://github.com/hypha-dao/hypha-web/issues/2570)).
- Per-room read markers on every candidate DM (Dendrite 429).
