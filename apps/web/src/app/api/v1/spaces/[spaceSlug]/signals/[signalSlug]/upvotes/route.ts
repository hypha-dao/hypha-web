import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  applyCoherenceUpvote,
  applyCoherenceUpvoteRemoval,
  schemaIngestedSignalUpvote,
  type CoherenceUpvoteTarget,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import {
  authorizeIngestion,
  loadOwnedSignal,
  resolvePersonRef,
} from '../../_lib/authorize-ingestion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { spaceSlug: string; signalSlug: string };

/** Maps the shared upvote guards onto status codes for API callers. */
const clientErrors: Array<{ pattern: RegExp; status: number }> = [
  { pattern: /^Cannot vote on an archived signal/, status: 409 },
  { pattern: /^Signal space is not linked to an on-chain space/, status: 409 },
  { pattern: /^A linked wallet is required/, status: 422 },
  { pattern: /^You have no voting power/, status: 422 },
];

function toErrorResponse(
  error: unknown,
  context: { spaceSlug: string; signalSlug: string; action: string },
) {
  const message = error instanceof Error ? error.message : String(error);
  const match = clientErrors.find((candidate) =>
    candidate.pattern.test(message),
  );
  if (match) {
    return NextResponse.json({ error: message }, { status: match.status });
  }
  console.error(`Failed to ${context.action} ingested signal upvote:`, {
    ...context,
    message,
  });
  return NextResponse.json(
    { error: `Failed to ${context.action} upvote` },
    { status: 500 },
  );
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

async function resolveContext(
  request: NextRequest,
  { spaceSlug, signalSlug }: Params,
) {
  const authorized = await authorizeIngestion(
    request,
    spaceSlug,
    'signals:upvote',
  );
  if ('response' in authorized) return { response: authorized.response };
  const { space, apiKey } = authorized.context;

  const owned = await loadOwnedSignal({ signalSlug, space, apiKey });
  if ('response' in owned) return { response: owned.response };

  if (typeof space.web3SpaceId !== 'number') {
    return {
      response: NextResponse.json(
        { error: 'Signal space is not linked to an on-chain space' },
        { status: 409 },
      ),
    };
  }

  const target: CoherenceUpvoteTarget = {
    id: owned.signal.id,
    spaceId: owned.spaceId,
    archived: owned.signal.archived,
    web3SpaceId: space.web3SpaceId,
  };

  return { target };
}

/**
 * Record an upvote on behalf of a community member who voted in the external
 * app. Weight still comes from the space's on-chain voting power source, so an
 * integration can allocate a share of what the member holds and never more.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const resolvedParams = await params;

  try {
    const context = await resolveContext(request, resolvedParams);
    if ('response' in context) return context.response;

    let payload: ReturnType<typeof schemaIngestedSignalUpvote.parse>;
    try {
      payload = schemaIngestedSignalUpvote.parse(await readJsonBody(request));
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.flatten() },
          { status: 400 },
        );
      }
      throw error;
    }

    // Unlike authorship, a voter cannot fall back to the space: an upvote only
    // means something as one member's weight, and upvotes are unique per person.
    const voter = await resolvePersonRef(payload.voter);
    if (!voter?.id) {
      return NextResponse.json(
        {
          error: `No Hypha person matches ${payload.voter.walletAddress}. The voter must have a Hypha profile with that wallet address.`,
        },
        { status: 422 },
      );
    }

    const upvotes = await applyCoherenceUpvote(
      {
        coherence: context.target,
        actor: voter,
        votingPowerPercent: payload.votingPowerPercent,
      },
      { db },
    );

    return NextResponse.json({ upvotes });
  } catch (error) {
    return toErrorResponse(error, { ...resolvedParams, action: 'record' });
  }
}

/** Remove a previously recorded upvote, e.g. when the member unallocates. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const resolvedParams = await params;

  try {
    const context = await resolveContext(request, resolvedParams);
    if ('response' in context) return context.response;

    // DELETE bodies are awkward for some clients, so `?voter=0x…` also works.
    const body = await readJsonBody(request);
    const walletAddress =
      new URL(request.url).searchParams.get('voter')?.trim() ||
      (body as { voter?: { walletAddress?: string } } | undefined)?.voter
        ?.walletAddress;

    if (!walletAddress) {
      return NextResponse.json(
        {
          error:
            'Identify the voter with a `voter` query parameter or a { voter: { walletAddress } } body.',
        },
        { status: 400 },
      );
    }

    const voter = await resolvePersonRef({ walletAddress });
    if (!voter?.id) {
      return NextResponse.json(
        { error: `No Hypha person matches ${walletAddress}.` },
        { status: 422 },
      );
    }

    const upvotes = await applyCoherenceUpvoteRemoval(
      { coherence: context.target, actor: voter },
      { db },
    );

    return NextResponse.json({ upvotes });
  } catch (error) {
    return toErrorResponse(error, { ...resolvedParams, action: 'remove' });
  }
}
