/**
 * Matrix room kind, written once into `m.room.create` (`creation_content.type`)
 * when the bot creates a room. Immutable, shared by every member, and readable
 * from synced state with `room.getType()`. Rooms created before this have no
 * type and keep falling back to the older heuristics.
 */
export const HYPHA_ROOM_TYPES = {
  /** Private 1:1, found through its `hypha-dm-<hash>` alias. */
  dm: 'io.hypha.room.dm',
  /** Private group chat started from Messages. */
  group: 'io.hypha.room.group',
  /** Discussion room of one signal (`coherences.room_id`). */
  signal: 'io.hypha.room.signal',
  /** Discussion room of one proposal (`documents.chat_room_id`). */
  proposal: 'io.hypha.room.proposal',
  /** Members-only room of a space (`spaces.chat_room_id`). */
  space: 'io.hypha.room.space',
  /** Public room of a space (`hypha-public-<slug>`). */
  spacePublic: 'io.hypha.room.space-public',
  /** The network-wide room (`hypha-network`). */
  network: 'io.hypha.room.network',
  /** One room per ecosystem root (`hypha-ecosystem-<slug>`). */
  ecosystem: 'io.hypha.room.ecosystem',
} as const;

export type HyphaRoomType =
  (typeof HYPHA_ROOM_TYPES)[keyof typeof HYPHA_ROOM_TYPES];
