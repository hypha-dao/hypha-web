import { NextResponse } from 'next/server';
import {
  authenticateSpaceApiKey,
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

export type SignalAuthorRef = {
  walletAddress?: string;
  email?: string;
};

/**
 * Map an integration's identifier for a person onto an existing Hypha person.
 * Returns null when there is no match — signals are never attributed to a
 * placeholder, and ingestion never writes to the `people` table.
 */
export async function resolveSignalAuthor(
  author: SignalAuthorRef,
): Promise<Person | null> {
  if (author.walletAddress) {
    const byWallet = await findPersonByWeb3Address(
      { address: author.walletAddress },
      { db },
    );
    if (byWallet) return byWallet;
  }

  if (author.email) {
    return findPersonByEmail({ email: author.email }, { db });
  }

  return null;
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

export function authorNotFoundResponse(author: SignalAuthorRef) {
  const identifier = author.walletAddress ?? author.email ?? 'the given author';
  return NextResponse.json(
    {
      error: `No Hypha person matches ${identifier}. The author must have a Hypha profile with a matching wallet address or email before their signals can be ingested.`,
    },
    { status: 422 },
  );
}
