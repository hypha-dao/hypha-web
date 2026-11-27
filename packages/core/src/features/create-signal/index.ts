import 'server-only';

import { z } from 'zod';

import type { WriteCtx } from '../../data-access/types';
import { createSignalUnlessDuplicate } from '../../data-access/signals';
import { findSpaceHostFieldsBySlug } from '../../data-access/spaces';
import { failure, type Failure } from '../../access/failure';
import {
  decideSpaceWrite,
  type WriteAccessDeps,
} from '../../access/write-access';
import { COHERENCE_SIGNAL_TYPES } from '../../coherence/coherence-types';
import type { OriginView } from '../../origin';
import {
  DUPLICATE_WINDOW_MS,
  contentFingerprint,
  normaliseForDuplicate,
  signalCreateRateKey,
  type WriteRateLimiter,
} from '../write-guards';

/** The scope a token needs to create signals (#2744). */
export const SIGNALS_WRITE_SCOPE = 'signals:write';

/** Tags an AI client may set: fewer and shorter than the app allows, since models over-tag. */
export const CREATE_SIGNAL_TAGS_MAX = 10;
export const CREATE_SIGNAL_TAG_MAX_LENGTH = 40;

/** Kept out on purpose: attribution is the origin, which the server sets (a tag can be edited away). */
const RESERVED_TAG = 'ai signal';

/** The app's own limits for a signal's title and description. */
const createSignalSchema = z.object({
  spaceSlug: z.string().trim().min(1).max(120),
  type: z.enum(COHERENCE_SIGNAL_TYPES),
  title: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(4000),
  tags: z
    .array(z.string().trim().min(1).max(CREATE_SIGNAL_TAG_MAX_LENGTH))
    .max(CREATE_SIGNAL_TAGS_MAX)
    .optional(),
});

export type CreateSignalInput = z.input<typeof createSignalSchema>;

export type CreatedSignal = {
  id: number;
  /** For the audit line only; not shown to a client. */
  spaceId: number;
  slug: string;
  spaceSlug: string;
  type: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
  /** True when this is the signal an identical earlier call created (nothing new was written). */
  duplicate: boolean;
  origin: OriginView;
};

export type CreateSignalDeps = {
  rateLimiter: WriteRateLimiter;
  /** Test seam for the membership chain read. */
  readMembership?: WriteAccessDeps['readMembership'];
};

/** Which rule refused the input, without echoing the input itself. */
const FIELD_RULES: Record<string, string> = {
  spaceSlug: 'The space slug is required.',
  type: `The type must be one of: ${COHERENCE_SIGNAL_TYPES.join(', ')}.`,
  title: 'The title must be 1 to 50 characters.',
  description: 'The description must be 1 to 4000 characters.',
  tags: `At most ${CREATE_SIGNAL_TAGS_MAX} tags, each 1 to ${CREATE_SIGNAL_TAG_MAX_LENGTH} characters.`,
};

/** Trimmed, without duplicates (case-insensitive, first spelling kept) and without the reserved tag. */
function cleanTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags ?? []) {
    const key = tag.toLowerCase();
    if (key === RESERVED_TAG || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/**
 * Feature function "create a signal" for a person acting through an AI client (#2744). In order:
 * validate the input, find the space, apply the write rule (scope, grant, visibility, on-chain
 * member or delegate), take one write from the person's rate budget, then create the signal unless
 * an identical one was created in the duplicate window. The origin is built by the edge from the
 * verified token (client id and the client's self-declared name), never from the input, and must
 * match the actor: an AI client origin with the same client id as the token. Nobody is notified.
 */
export async function createSignal(
  input: CreateSignalInput,
  ctx: WriteCtx,
  { rateLimiter, readMembership }: CreateSignalDeps,
): Promise<{ ok: true; data: CreatedSignal } | Failure> {
  const caller = ctx.actor;
  if (caller.kind !== 'user' || !caller.via) {
    return failure('unauthenticated', 'A verified user is required.');
  }
  const clientId = caller.via.clientId?.trim();
  if (!clientId) {
    // A write is always attributed to a client; a token without one is refused, not anonymous.
    return failure('forbidden', 'This app was not allowed to write.');
  }
  // The edge builds the origin; it has to name this same client, or nothing is written.
  if (ctx.origin.kind !== 'mcp_client' || ctx.origin.clientId !== clientId) {
    return failure('forbidden', 'This app was not allowed to write.');
  }

  const parsed = createSignalSchema.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? '');
    return failure('invalid_input', FIELD_RULES[field] ?? 'Invalid input.');
  }
  const { spaceSlug, type, title, description } = parsed.data;
  const tags = cleanTags(parsed.data.tags);

  const space = await findSpaceHostFieldsBySlug(ctx, { slug: spaceSlug });
  if (!space) return failure('not_found', 'Space not found');

  const allowed = await decideSpaceWrite(
    space,
    ctx,
    { scope: SIGNALS_WRITE_SCOPE },
    { readMembership },
  );
  if (!allowed.ok) return allowed;

  // After the access checks, so a refused call spends nothing; a duplicate still counts.
  const slot = await rateLimiter.take(signalCreateRateKey(caller.person.id));
  if (!slot.ok) {
    return failure('rate_limited', 'Too many signals created.', {
      retryAfterSeconds: slot.retryAfterSeconds,
    });
  }

  const fingerprint = contentFingerprint({
    personId: caller.person.id,
    spaceId: space.id,
    clientId,
    title,
    description,
  });
  const wantedTitle = normaliseForDuplicate(title);
  const wantedDescription = normaliseForDuplicate(description);

  const created = await createSignalUnlessDuplicate(
    ctx,
    {
      spaceId: space.id,
      creatorId: caller.person.id,
      type,
      title,
      description,
      tags,
    },
    {
      fingerprint,
      windowSeconds: DUPLICATE_WINDOW_MS / 1000,
      sameContent: (row) =>
        normaliseForDuplicate(row.title) === wantedTitle &&
        normaliseForDuplicate(row.description) === wantedDescription,
    },
  );

  const { signal } = created;
  return {
    ok: true,
    data: {
      id: signal.id,
      spaceId: space.id,
      slug: signal.slug,
      spaceSlug: space.slug,
      type: signal.type,
      title: signal.title,
      description: signal.description,
      tags: signal.tags,
      createdAt: signal.createdAt.toISOString(),
      duplicate: created.duplicate,
      origin: signal.origin,
    },
  };
}
