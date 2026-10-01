import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  notLike,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  coherences,
  documents,
  memberships,
  people,
  spaces,
} from '@hypha-platform/storage-postgres';

import type { DbConfig } from '../../server';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import { SPACE_ACTOR_SUB_PREFIX } from './space-actor-person';
import {
  buildMemberGuidance,
  parseMemberOrientation,
} from '../member-intelligence-guidance';
import type {
  MemberAttentionItem,
  MemberIntelligence,
  NetworkCapitalAsk,
} from '../member-intelligence';

export {
  MEMBER_ORIENTATIONS,
  buildMemberGuidance,
  parseMemberOrientation,
  type MemberOrientation,
} from '../member-intelligence-guidance';
export type {
  MemberAttentionItem,
  MemberIntelligence,
  NetworkCapitalAsk,
} from '../member-intelligence';

const ATTENTION_LIMIT = 8;
const LIST_LIMIT = 6;

function excerpt(value: string | null | undefined, max = 180): string {
  const text = (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export async function getMemberIntelligence(
  { personId, limit = LIST_LIMIT }: { personId: number; limit?: number },
  { db }: DbConfig,
): Promise<MemberIntelligence | null> {
  const listLimit = Math.min(Math.max(limit, 1), 24);

  const [person] = await db
    .select()
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  if (!person?.slug) return null;

  const spaceRows = await db
    .select({
      id: spaces.id,
      slug: spaces.slug,
      title: spaces.title,
      description: spaces.description,
      logoUrl: spaces.logoUrl,
    })
    .from(spaces)
    .innerJoin(memberships, eq(memberships.spaceId, spaces.id))
    .where(
      and(eq(memberships.personId, personId), eq(spaces.isArchived, false)),
    )
    .orderBy(desc(memberships.createdAt));

  const spaceIds = spaceRows.map((space) => space.id);
  const orientation = parseMemberOrientation(person.primaryOrientation);

  const proposalRows =
    spaceIds.length === 0
      ? []
      : await db
          .select({
            id: documents.id,
            slug: documents.slug,
            title: documents.title,
            state: documents.state,
            label: documents.label,
            description: documents.description,
            creatorId: documents.creatorId,
            createdAt: documents.createdAt,
            spaceSlug: spaces.slug,
            spaceTitle: spaces.title,
          })
          .from(documents)
          .innerJoin(spaces, eq(documents.spaceId, spaces.id))
          .where(
            and(
              inArray(documents.spaceId, spaceIds),
              inArray(documents.state, ['proposal', 'discussion']),
            ),
          )
          .orderBy(desc(documents.createdAt))
          .limit(listLimit);

  const openProposalCount =
    spaceIds.length === 0
      ? 0
      : (
          await db
            .select({
              value: sql<number>`cast(count(*) as integer)`,
            })
            .from(documents)
            .where(
              and(
                inArray(documents.spaceId, spaceIds),
                eq(documents.state, 'proposal'),
              ),
            )
        )[0]?.value ?? 0;

  const signalRows =
    spaceIds.length === 0
      ? []
      : await db
          .select({
            id: coherences.id,
            slug: coherences.slug,
            title: coherences.title,
            type: coherences.type,
            priority: coherences.priority,
            assigneeIds: coherences.assigneeIds,
            spaceSlug: spaces.slug,
            spaceTitle: spaces.title,
          })
          .from(coherences)
          .innerJoin(spaces, eq(coherences.spaceId, spaces.id))
          .where(
            and(
              inArray(coherences.spaceId, spaceIds),
              or(eq(coherences.archived, false), isNull(coherences.archived)),
            ),
          )
          .orderBy(desc(coherences.updatedAt))
          .limit(listLimit);

  const signalCount =
    spaceIds.length === 0
      ? 0
      : (
          await db
            .select({
              value: sql<number>`cast(count(*) as integer)`,
            })
            .from(coherences)
            .where(
              and(
                inArray(coherences.spaceId, spaceIds),
                or(eq(coherences.archived, false), isNull(coherences.archived)),
              ),
            )
        )[0]?.value ?? 0;

  const others = alias(memberships, 'shared_memberships');
  const connectionRows =
    spaceIds.length === 0
      ? []
      : await db
          .select({
            id: people.id,
            slug: people.slug,
            name: people.name,
            surname: people.surname,
            nickname: people.nickname,
            avatarUrl: people.avatarUrl,
            sharedSpaceCount: sql<number>`cast(count(*) as integer)`,
          })
          .from(memberships)
          .innerJoin(
            others,
            and(
              eq(others.spaceId, memberships.spaceId),
              ne(others.personId, personId),
            ),
          )
          .innerJoin(people, eq(people.id, others.personId))
          .where(
            and(
              eq(memberships.personId, personId),
              inArray(memberships.spaceId, spaceIds),
              or(
                isNull(people.sub),
                notLike(people.sub, `${SPACE_ACTOR_SUB_PREFIX}%`),
              ),
            ),
          )
          .groupBy(
            people.id,
            people.slug,
            people.name,
            people.surname,
            people.nickname,
            people.avatarUrl,
          )
          .orderBy(desc(sql`count(*)`))
          .limit(listLimit);

  const connectionCountRow =
    spaceIds.length === 0
      ? []
      : await db
          .select({
            value: sql<number>`cast(count(distinct ${others.personId}) as integer)`,
          })
          .from(memberships)
          .innerJoin(
            others,
            and(
              eq(others.spaceId, memberships.spaceId),
              ne(others.personId, personId),
            ),
          )
          .innerJoin(people, eq(people.id, others.personId))
          .where(
            and(
              eq(memberships.personId, personId),
              inArray(memberships.spaceId, spaceIds),
              or(
                isNull(people.sub),
                notLike(people.sub, `${SPACE_ACTOR_SUB_PREFIX}%`),
              ),
            ),
          );

  const capitalAskCount =
    (
      await db
        .select({ value: sql<number>`cast(count(*) as integer)` })
        .from(documents)
        .innerJoin(spaces, eq(documents.spaceId, spaces.id))
        .where(
          and(
            eq(documents.label, 'Investment'),
            inArray(documents.state, ['proposal', 'agreement']),
            eq(spaces.isArchived, false),
          ),
        )
    )[0]?.value ?? 0;

  const proposals = proposalRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title?.trim() || 'Untitled proposal',
    state: row.state,
    label: row.label,
    spaceSlug: row.spaceSlug,
    spaceTitle: row.spaceTitle,
    createdAt: row.createdAt.toISOString(),
    authoredByMember: row.creatorId === personId,
  }));

  const signals = signalRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    priority: row.priority,
    spaceSlug: row.spaceSlug,
    spaceTitle: row.spaceTitle,
    assignedToMember: (row.assigneeIds ?? []).includes(personId),
  }));

  const attention: MemberAttentionItem[] = [];
  for (const proposal of proposals) {
    if (proposal.state !== 'proposal' || proposal.authoredByMember) continue;
    if (!proposal.slug) continue;
    attention.push({
      id: `proposal-${proposal.id}`,
      kind: 'proposal',
      title: proposal.title,
      detail: `${proposal.spaceTitle} · a decision`,
      spaceSlug: proposal.spaceSlug,
      spaceTitle: proposal.spaceTitle,
      targetSlug: proposal.slug,
    });
    if (attention.length >= ATTENTION_LIMIT) break;
  }
  if (attention.length < ATTENTION_LIMIT) {
    for (const signal of signals) {
      if (!signal.assignedToMember || !signal.slug) continue;
      attention.push({
        id: `signal-${signal.id}`,
        kind: 'signal',
        title: signal.title,
        detail: `${signal.spaceTitle} · a signal`,
        spaceSlug: signal.spaceSlug,
        spaceTitle: signal.spaceTitle,
        targetSlug: signal.slug,
      });
      if (attention.length >= ATTENTION_LIMIT) break;
    }
  }

  const firstName = person.name?.trim() || person.nickname?.trim() || 'there';

  return {
    person: {
      id: person.id,
      slug: person.slug,
      name: person.name,
      surname: person.surname,
      nickname: person.nickname,
      avatarUrl: person.avatarUrl,
      description: person.description,
      address: person.address,
      preferredCurrency: person.preferredCurrency,
      primaryOrientation: orientation,
    },
    counts: {
      spaces: spaceRows.length,
      openProposals: Number(openProposalCount) || 0,
      signals: Number(signalCount) || 0,
      connections:
        Number(connectionCountRow[0]?.value ?? connectionRows.length) || 0,
      notifications: attention.length,
      capitalAsks: Number(capitalAskCount) || 0,
    },
    guidance: {
      narrative: buildMemberGuidance({
        firstName,
        orientation,
        attention: attention[0] ?? null,
        spaceCount: spaceRows.length,
      }),
    },
    attention,
    spaces: spaceRows.slice(0, listLimit).map((space) => ({
      ...space,
      description: excerpt(space.description, 120),
    })),
    proposals,
    signals,
    notifications: attention,
    connections: connectionRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      surname: row.surname,
      nickname: row.nickname,
      avatarUrl: row.avatarUrl,
      sharedSpaceCount: Number(row.sharedSpaceCount) || 0,
    })),
    wallet: {
      address: person.address,
      preferredCurrency: person.preferredCurrency,
    },
    chatSpaceSlug: spaceRows[0]?.slug ?? null,
  };
}

export async function listNetworkCapitalAsks(
  { limit = 24 }: { limit?: number },
  { db, authToken }: DbConfig & { authToken?: string },
): Promise<NetworkCapitalAsk[]> {
  const rows = await db
    .select({
      id: documents.id,
      slug: documents.slug,
      title: documents.title,
      description: documents.description,
      state: documents.state,
      createdAt: documents.createdAt,
      spaceId: spaces.id,
      web3SpaceId: spaces.web3SpaceId,
      spaceSlug: spaces.slug,
      spaceTitle: spaces.title,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .where(
      and(
        eq(documents.label, 'Investment'),
        inArray(documents.state, ['proposal', 'agreement']),
        eq(spaces.isArchived, false),
      ),
    )
    .orderBy(desc(documents.createdAt))
    .limit(50);

  const accessibleRows = (
    await Promise.all(
      rows.map(async (row) => {
        const gate = await checkSpaceAccessForSpace(
          { id: row.spaceId, web3SpaceId: row.web3SpaceId },
          authToken,
        );
        return gate.hasAccess ? row : null;
      }),
    )
  ).filter((row): row is (typeof rows)[number] => row !== null);

  return accessibleRows
    .slice(0, Math.min(Math.max(limit, 1), 50))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title?.trim() || 'Untitled ask',
      excerpt: excerpt(row.description),
      state: row.state,
      spaceSlug: row.spaceSlug,
      spaceTitle: row.spaceTitle,
      createdAt: row.createdAt.toISOString(),
    }));
}
