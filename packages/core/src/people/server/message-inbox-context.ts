import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { coherences, spaces } from '@hypha-platform/storage-postgres';

import { web3Client } from '../../common/server/web3-rpc/client';
import type { DbConfig } from '../../common/server/types';
import { getMemberSpaces } from '../../space/client/web3/dao-space-factory/get-member-spaces';
import {
  labelInboxSpaces,
  type MessageInboxSpaceLabel,
  type MessageInboxSpaceNode,
} from './message-inbox-labels';

export {
  labelInboxSpaces,
  type MessageInboxSpaceLabel,
  type MessageInboxSpaceNode,
} from './message-inbox-labels';

export type MessageInboxSignalLabel = {
  roomId: string;
  title: string;
  type: string;
  slug: string;
  spaceSlug: string;
  spaceTitle: string;
  rootSlug: string;
  rootTitle: string;
  /** True when this member is an assignee and signal messages notify them. */
  notified: boolean;
};

export type MessageInboxContext = {
  spaces: MessageInboxSpaceLabel[];
  signals: MessageInboxSignalLabel[];
};

const SIGNAL_LABEL_LIMIT = 400;
/** Every signal that emails or pushes this member. Do not drop one of these. */
const NOTIFIED_SIGNAL_LIMIT = 1000;
const MEMBER_SPACES_TIMEOUT_MS = 8_000;

type SpaceRow = {
  id: number;
  slug: string | null;
  title: string | null;
  parentId: number | null;
  chatRoomId: string | null;
};

type SignalRow = {
  roomId: string | null;
  title: string;
  type: string;
  slug: string | null;
  spaceId: number | null;
  assigneeIds: number[] | null;
};

function toNode(space: SpaceRow): MessageInboxSpaceNode | null {
  const slug = space.slug?.trim();
  const title = space.title?.trim();
  if (!slug || !title) return null;
  return {
    id: space.id,
    slug,
    title,
    parentId: space.parentId,
    chatRoomId: space.chatRoomId?.trim() || null,
  };
}

function walletAddress(
  address: string | null | undefined,
): `0x${string}` | null {
  const value = address?.trim();
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}

function assigneeIncludes(ids: unknown, memberId: number): boolean {
  if (!Array.isArray(ids)) return false;
  return ids.some((id) => Number(id) === memberId);
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('member spaces timed out')),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * On-chain spaces for this wallet. Postgres `memberships` is not the live
 * roster. A failed read means we cannot prove membership, so the caller
 * gets no spaces rather than every joined room.
 */
async function chainMemberSpaceRows(
  address: string | null | undefined,
  db: DbConfig['db'],
): Promise<SpaceRow[]> {
  const wallet = walletAddress(address);
  if (!wallet) return [];
  const web3SpaceIds = (await withTimeout(
    web3Client.readContract(getMemberSpaces({ memberAddress: wallet })),
    MEMBER_SPACES_TIMEOUT_MS,
  )) as readonly bigint[];
  const ids = [
    ...new Set(
      web3SpaceIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (ids.length === 0) return [];
  return db
    .select({
      id: spaces.id,
      slug: spaces.slug,
      title: spaces.title,
      parentId: spaces.parentId,
      chatRoomId: spaces.chatRoomId,
    })
    .from(spaces)
    .where(and(inArray(spaces.web3SpaceId, ids), eq(spaces.isArchived, false)));
}

const signalColumns = {
  roomId: coherences.roomId,
  title: coherences.title,
  type: coherences.type,
  slug: coherences.slug,
  spaceId: coherences.spaceId,
  assigneeIds: coherences.assigneeIds,
};

function openSignalFilter() {
  return and(
    isNotNull(coherences.roomId),
    or(eq(coherences.archived, false), isNull(coherences.archived)),
  );
}

/**
 * Names for rooms the member already belongs to. Read-only: it does not
 * create or retarget any Matrix room.
 *
 * Spaces are the ones this wallet is a member of. Signals are the ones
 * that notify this member, plus other signals in those spaces so a team
 * thread can still be named. Joining a room is not enough.
 */
export async function getMessageInboxContext(
  {
    memberId,
    walletAddress: address,
  }: { memberId: number; walletAddress?: string | null },
  { db }: DbConfig,
): Promise<MessageInboxContext> {
  const [memberSpaceRows, notifiedRows] = await Promise.all([
    chainMemberSpaceRows(address, db).catch((error) => {
      console.error(
        '[message-inbox-context] member spaces unavailable',
        error instanceof Error ? error.message : 'unknown',
      );
      return [] as SpaceRow[];
    }),
    db
      .select(signalColumns)
      .from(coherences)
      .where(
        and(
          openSignalFilter(),
          sql`${coherences.assigneeIds} @> ${JSON.stringify([
            memberId,
          ])}::jsonb`,
        ),
      )
      .orderBy(desc(coherences.updatedAt))
      .limit(NOTIFIED_SIGNAL_LIMIT),
  ]);

  const nodes = new Map<number, MessageInboxSpaceNode>();
  const memberIds = new Set<number>();
  for (const space of memberSpaceRows) {
    const node = toNode(space);
    if (!node) continue;
    nodes.set(node.id, node);
    memberIds.add(node.id);
  }

  const signalRows = new Map<string, SignalRow>();
  for (const row of notifiedRows) {
    const roomId = row.roomId?.trim();
    if (roomId) signalRows.set(roomId, row);
  }

  const extraSpaceIds = new Set<number>();
  for (const row of signalRows.values()) {
    if (row.spaceId != null && !nodes.has(row.spaceId)) {
      extraSpaceIds.add(row.spaceId);
    }
  }
  if (extraSpaceIds.size > 0) {
    const extras = await db
      .select({
        id: spaces.id,
        slug: spaces.slug,
        title: spaces.title,
        parentId: spaces.parentId,
        chatRoomId: spaces.chatRoomId,
      })
      .from(spaces)
      .where(inArray(spaces.id, [...extraSpaceIds]));
    for (const space of extras) {
      const node = toNode(space);
      if (node && !nodes.has(node.id)) nodes.set(node.id, node);
    }
  }

  let pending = [...nodes.values()].flatMap((node) =>
    node.parentId != null && !nodes.has(node.parentId) ? [node.parentId] : [],
  );
  for (let hop = 0; hop < 8 && pending.length > 0; hop += 1) {
    const rows = await db
      .select({
        id: spaces.id,
        slug: spaces.slug,
        title: spaces.title,
        parentId: spaces.parentId,
        chatRoomId: spaces.chatRoomId,
      })
      .from(spaces)
      .where(inArray(spaces.id, pending));
    pending = [];
    for (const row of rows) {
      const node = toNode(row);
      if (!node || nodes.has(node.id)) continue;
      nodes.set(node.id, node);
      if (node.parentId != null && !nodes.has(node.parentId)) {
        pending.push(node.parentId);
      }
    }
  }

  const labeled = labelInboxSpaces([...nodes.values()]);
  const memberSpaces = labeled.filter((space) => memberIds.has(space.id));
  const spaceIds = memberSpaces.map((space) => space.id);
  if (spaceIds.length > 0 && signalRows.size < SIGNAL_LABEL_LIMIT) {
    const more = await db
      .select(signalColumns)
      .from(coherences)
      .where(and(openSignalFilter(), inArray(coherences.spaceId, spaceIds)))
      .orderBy(desc(coherences.updatedAt))
      .limit(SIGNAL_LABEL_LIMIT);
    for (const row of more) {
      const roomId = row.roomId?.trim();
      if (!roomId || signalRows.has(roomId)) continue;
      if (signalRows.size >= SIGNAL_LABEL_LIMIT) break;
      signalRows.set(roomId, row);
    }
  }

  const byId = new Map(labeled.map((space) => [space.id, space]));
  const signals = [...signalRows.values()].flatMap((row) => {
    const roomId = row.roomId?.trim();
    const slug = row.slug?.trim();
    const title = row.title?.trim();
    const space = row.spaceId == null ? null : byId.get(row.spaceId);
    if (!roomId || !slug || !title || !space) return [];
    return [
      {
        roomId,
        title,
        type: row.type?.trim() || 'Signal',
        slug,
        spaceSlug: space.slug,
        spaceTitle: space.title,
        rootSlug: space.rootSlug,
        rootTitle: space.rootTitle,
        notified: assigneeIncludes(row.assigneeIds, memberId),
      },
    ];
  });

  return { spaces: memberSpaces, signals };
}
