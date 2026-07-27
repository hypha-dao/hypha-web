import { NextResponse } from 'next/server';
import {
  authenticateSpaceApiKey,
  ensureSpaceActorPerson,
  findCoherenceBySlug,
  findPersonByEmail,
  findPersonByWeb3Address,
  findSpaceBySlug,
  normalizeCoherence,
  type AuthenticatedSpaceApiKey,
  type Person,
  type SpaceApiKeyScope,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Space = NonNullable<Awaited<ReturnType<typeof findSpaceBySlug>>>;

export type IngestionContext = {
  space: Space;
  apiKey: AuthenticatedSpaceApiKey;
};

/**
 * Resolve the target space and verify the caller's integration key against it.
 *
 * Unlike the member-facing signal routes this deliberately does not consult
 * space transparency: a key is a per-space grant, so a public space does not
 * become writable and a private space stays writable by its own integration.
 */
export async function authorizeIngestion(
  request: Request,
  spaceSlug: string,
  requiredScope: SpaceApiKeyScope,
): Promise<{ context: IngestionContext } | { response: NextResponse }> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      response: NextResponse.json(
        { error: 'Space not found' },
        { status: 404 },
      ),
    };
  }

  const auth = await authenticateSpaceApiKey(
    { request, spaceId: space.id, requiredScope },
    { db },
  );
  if (!auth.ok) {
    return {
      response: NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      ),
    };
  }

  return { context: { space, apiKey: auth.apiKey } };
}

export type PersonRef = {
  walletAddress?: string;
  email?: string;
};

export type ResolvedSignalAuthor = {
  personId: number;
  /** True when the payload's author was unknown and the space stood in. */
  attributedToSpace: boolean;
};

/**
 * Map an integration's identifier for someone onto an existing Hypha person.
 * The wallet is tried first when both are given. Returns null when neither
 * matches — no person is ever created to satisfy a lookup.
 */
export async function resolvePersonRef(ref: PersonRef): Promise<Person | null> {
  if (ref.walletAddress) {
    const byWallet = await findPersonByWeb3Address(
      { address: ref.walletAddress },
      { db },
    );
    if (byWallet) return byWallet;
  }

  if (ref.email) {
    return findPersonByEmail({ email: ref.email }, { db });
  }

  return null;
}

/**
 * Decide who an ingested signal is attributed to.
 *
 * An author Hypha already knows is used directly. When the author is omitted or
 * matches nobody, the signal is attributed to the space itself, so an
 * integration is never blocked by a contributor who has not linked the wallet or
 * email the external app knows them by. The space actor holds no wallet and no
 * membership, so the signal carries no voting power and cannot vote.
 */
export async function resolveSignalAuthorOrSpace(
  author: PersonRef | undefined,
  space: Space,
): Promise<ResolvedSignalAuthor> {
  const person = author ? await resolvePersonRef(author) : null;
  if (person?.id) {
    return { personId: person.id, attributedToSpace: false };
  }

  const spaceActor = await ensureSpaceActorPerson({ space }, { db });
  return { personId: spaceActor.id, attributedToSpace: true };
}

/**
 * Load a signal and confirm the calling key owns it: same space, and written
 * by the same integration `source`. Signals authored in the Hypha UI have no
 * source, so they are never mutable through the ingestion API.
 */
export async function loadOwnedSignal({
  signalSlug,
  space,
  apiKey,
}: {
  signalSlug: string;
  space: Space;
  apiKey: AuthenticatedSpaceApiKey;
}) {
  const row = await findCoherenceBySlug({ slug: signalSlug }, { db });
  if (!row || row.spaceId !== space.id) {
    return {
      response: NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 },
      ),
    };
  }

  if (row.source !== apiKey.source) {
    return {
      response: NextResponse.json(
        {
          error:
            'This signal was not created by this integration, so it cannot be modified through the API.',
        },
        { status: 403 },
      ),
    };
  }

  return { signal: normalizeCoherence(row), spaceId: row.spaceId };
}
