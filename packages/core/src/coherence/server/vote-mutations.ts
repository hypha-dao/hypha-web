import { coherenceVotes, coherences } from '@hypha-platform/storage-postgres';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '../../server';
import { findCoherenceBySlug } from './queries';
import { findSelf } from '../../people/server/queries';
import { personMayInteractWithCoherenceSpace } from './coherence-space-access';
import { normalizeCoherence } from './web3/normalize-coherence';

export async function setCoherenceVoteBySlug(
  {
    slug,
    value,
    authToken,
  }: {
    slug: string;
    /** +1 up, -1 down, 0 removes vote */
    value: -1 | 0 | 1;
    /** Same JWT as server actions — needed for roster-style space access checks. */
    authToken?: string;
  },
  { db }: { db: DatabaseInstance },
) {
  const coherence = await findCoherenceBySlug({ slug }, { db });
  if (!coherence?.spaceId) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }

  const person = await findSelf({ db });
  if (!person) {
    throw new Error('Authentication required to vote');
  }

  const allowed = await personMayInteractWithCoherenceSpace(
    person,
    coherence.spaceId,
    { db, authToken },
  );
  if (!allowed) {
    throw new Error('You must be a member or delegate of this space to vote');
  }

  const coherenceId = coherence.id;

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: coherenceVotes.id,
        value: coherenceVotes.value,
      })
      .from(coherenceVotes)
      .where(
        and(
          eq(coherenceVotes.coherenceId, coherenceId),
          eq(coherenceVotes.personId, person.id),
        ),
      )
      .limit(1)
      .for('update');

    if (value === 0) {
      if (!existing) {
        return normalizeCoherence(coherence);
      }
      await tx.delete(coherenceVotes).where(eq(coherenceVotes.id, existing.id));
      await tx
        .update(coherences)
        .set({
          voteScore: sql`${coherences.voteScore} - ${existing.value}`,
        })
        .where(eq(coherences.id, coherenceId));
    } else {
      const previous = existing?.value ?? 0;
      if (previous === value) {
        const [row] = await tx
          .select()
          .from(coherences)
          .where(eq(coherences.id, coherenceId));
        return normalizeCoherence(row ?? coherence);
      }
      const delta = value - previous;

      if (existing) {
        await tx
          .update(coherenceVotes)
          .set({
            value,
            updatedAt: sql`now()`,
          })
          .where(eq(coherenceVotes.id, existing.id));
      } else {
        await tx.insert(coherenceVotes).values({
          coherenceId,
          personId: person.id,
          value,
        });
      }

      await tx
        .update(coherences)
        .set({
          voteScore: sql`${coherences.voteScore} + ${delta}`,
        })
        .where(eq(coherences.id, coherenceId));
    }

    const [updated] = await tx
      .select()
      .from(coherences)
      .where(eq(coherences.id, coherenceId));
    return normalizeCoherence(updated ?? coherence);
  });
}

export async function getCoherenceVoteStateBySlug(
  { slug }: { slug: string },
  { db }: { db: DatabaseInstance },
) {
  const coherence = await findCoherenceBySlug({ slug }, { db });
  if (!coherence) {
    return null;
  }

  const person = await findSelf({ db });
  let myVote: -1 | 0 | 1 = 0;
  if (person) {
    const [row] = await db
      .select({ value: coherenceVotes.value })
      .from(coherenceVotes)
      .where(
        and(
          eq(coherenceVotes.coherenceId, coherence.id),
          eq(coherenceVotes.personId, person.id),
        ),
      )
      .limit(1);
    if (row?.value === -1 || row?.value === 1) {
      myVote = row.value;
    }
  }

  return {
    coherence: normalizeCoherence(coherence),
    myVote,
  };
}

/** Current user's vote per coherence id for a space (for list UI). */
export async function getMyCoherenceVotesForSpace(
  { spaceId }: { spaceId: number },
  { db }: { db: DatabaseInstance },
): Promise<Record<number, -1 | 1>> {
  const person = await findSelf({ db });
  if (!person) {
    return {};
  }

  const rows = await db
    .select({
      coherenceId: coherenceVotes.coherenceId,
      value: coherenceVotes.value,
    })
    .from(coherenceVotes)
    .innerJoin(coherences, eq(coherenceVotes.coherenceId, coherences.id))
    .where(
      and(
        eq(coherences.spaceId, spaceId),
        eq(coherenceVotes.personId, person.id),
      ),
    );

  const out: Record<number, -1 | 1> = {};
  for (const row of rows) {
    if (row.value === -1 || row.value === 1) {
      out[row.coherenceId] = row.value;
    }
  }
  return out;
}

export async function getMyCoherenceVotesForCoherenceIds(
  { coherenceIds }: { coherenceIds: number[] },
  { db }: { db: DatabaseInstance },
): Promise<Record<number, -1 | 1>> {
  if (coherenceIds.length === 0) {
    return {};
  }
  const person = await findSelf({ db });
  if (!person) {
    return {};
  }

  const rows = await db
    .select({
      coherenceId: coherenceVotes.coherenceId,
      value: coherenceVotes.value,
    })
    .from(coherenceVotes)
    .where(
      and(
        inArray(coherenceVotes.coherenceId, coherenceIds),
        eq(coherenceVotes.personId, person.id),
      ),
    );

  const out: Record<number, -1 | 1> = {};
  for (const row of rows) {
    if (row.value === -1 || row.value === 1) {
      out[row.coherenceId] = row.value;
    }
  }
  return out;
}
