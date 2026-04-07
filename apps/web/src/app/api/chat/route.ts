import { convertToModelMessages, stepCountIs, streamText } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';
import type { UIMessage } from 'ai';
import {
  findSpaceBySlug,
  getSpaceBySlug,
  getSpaceMembersRoster,
  serializeSpaceMembersRosterDatesForJson,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';

// Fetch JWKS directly from Privy's endpoint instead of the app's own
// /.well-known/jwks.json route. On Vercel preview deployments, server-side
// fetches to the same deployment are blocked by Vercel's SSO deployment
// protection (the server doesn't carry the _vercel_jwt cookie).
// Using Privy's external JWKS endpoint avoids this entirely.
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
if (!PRIVY_APP_ID) {
  throw new Error('Missing required env var: NEXT_PUBLIC_PRIVY_APP_ID');
}
const PRIVY_JWKS_URL = new URL(
  `/api/v1/apps/${PRIVY_APP_ID}/jwks.json`,
  'https://auth.privy.io',
);
const JWKS = createRemoteJWKSet(PRIVY_JWKS_URL);

async function verifyAuthToken(
  token: string,
): Promise<{ valid: true } | { valid: false; reason: string }> {
  try {
    await jwtVerify(token, JWKS);
    return { valid: true };
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      return { valid: false, reason: 'Token expired' };
    }
    if (error instanceof joseErrors.JWSSignatureVerificationFailed) {
      return { valid: false, reason: 'Invalid token signature' };
    }
    if (error instanceof joseErrors.JWKSNoMatchingKey) {
      return { valid: false, reason: 'No matching key found' };
    }
    return {
      valid: false,
      reason: 'Token verification failed',
    };
  }
}

const chatRequestSchema = z.object({
  messages: z.array(z.record(z.unknown())),
  spaceSlug: z.string().nullish(),
});

export const maxDuration = 30;

const OPENROUTER_DEBUG = process.env.OPENROUTER_DEBUG === 'true';

function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { name?: string; message?: string };
  return (
    maybeError.name === 'AbortError' ||
    maybeError.message?.toLowerCase().includes('aborted') === true
  );
}

const BASE_SYSTEM_PROMPT =
  'You are Hypha AI, a helpful assistant for the Hypha DAO platform.';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function sanitizeSlug(slug: string): string | null {
  const trimmed = slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(trimmed) || trimmed.length > 128) return null;
  return trimmed;
}

function buildSystemPrompt(spaceSlug?: string | null): string {
  if (spaceSlug) {
    const safe = sanitizeSlug(spaceSlug);
    if (!safe) return BASE_SYSTEM_PROMPT;
    return `${BASE_SYSTEM_PROMPT}\n\nThe user is currently viewing the space with slug "${safe}".\n\nTool choice:\n- get_space_by_slug: space profile and aggregate numbers only (title, description, member count, document count, subspace count). Use for "tell me about this space", stats, or overview — not for listing people.\n- get_people_by_space_slug: the full member roster (people and space-type members, join times, membership fields). Use for "who are the members", "list members", "member names", roster, or join dates — always with space_slug "${safe}".\n\nIf the user asks about members as people or a list, you must call get_people_by_space_slug, not get_space_by_slug.`;
  }
  return BASE_SYSTEM_PROMPT;
}

function createGetPeopleBySpaceSlugTool(req: Request) {
  const inputSchema = z.object({
    space_slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug of the active space'),
    page: z.number().int().min(1).optional().default(1),
    page_size: z.number().int().min(1).max(100).optional().default(20),
    searchTerm: z.string().optional(),
  });

  return {
    description:
      'Read-only: lists members of a Hypha space by slug — people and other spaces that appear as on-chain members (Members tab parity). Join times use memberships when present, else joinSpace events (joined_at and join_source in the result). Includes full memberships fields for people when stored in the database. Use for roster, who belongs, which other spaces are in the member list, and when someone joined. Not for listing child subspaces by parent_id.',
    inputSchema,
    execute: async (args: z.infer<typeof inputSchema>) => {
      const safe = sanitizeSlug(args.space_slug);
      if (!safe) {
        return {
          found: false,
          space_slug: args.space_slug,
          error: 'Invalid space slug format',
        };
      }

      try {
        const host = await findSpaceBySlug({ slug: safe }, { db });
        if (
          host?.web3SpaceId != null &&
          canConvertToBigInt(host.web3SpaceId as number)
        ) {
          const access = await checkSpaceAccess(
            new NextRequest(req.url, { headers: req.headers }),
            host.web3SpaceId as number,
          );
          if (!access.hasAccess) {
            let message = 'Access denied';
            try {
              if (access.response) {
                const body = await access.response.json();
                if (body && typeof body.message === 'string') {
                  message = body.message;
                }
              }
            } catch {
              /* ignore */
            }
            return {
              found: false,
              space_slug: safe,
              error: message,
            };
          }
        }

        const raw = await getSpaceMembersRoster(
          {
            spaceSlug: safe,
            page: args.page,
            pageSize: args.page_size,
            searchTerm: args.searchTerm,
          },
          { db },
        );
        return serializeSpaceMembersRosterDatesForJson(raw);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return {
          found: false,
          space_slug: safe,
          error: message,
        };
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI SDK tool() and Tool type trigger TS2589 (heap OOM) in CI
const getSpaceBySlugTool: any = {
  description:
    'Returns one Hypha space record: title, description, and aggregate counts (member count, document count, subspace count). Use for overview or "tell me about this space". Do not use for listing who the members are, names, roster, or join dates — use get_people_by_space_slug for any question about the member list or individuals.',
  inputSchema: z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug, for example "hypha"'),
  }),
  execute: async ({ slug }: { slug: string }) => {
    let space;
    try {
      space = await getSpaceBySlug({ slug });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { found: false, slug, space: null, error: message };
    }
    if (!space) {
      return { found: false, slug, space: null };
    }

    const result = {
      found: true,
      slug,
      space: {
        id: String(space.id),
        slug: space.slug,
        title: space.title,
        description: space.description ?? null,
        parentId: space.parentId ? String(space.parentId) : null,
        web3SpaceId: space.web3SpaceId ?? null,
        memberCount:
          typeof space.memberCount === 'number'
            ? space.memberCount
            : Array.isArray(space.members)
            ? space.members.length
            : 0,
        documentCount:
          typeof space.documentCount === 'number'
            ? space.documentCount
            : Array.isArray(space.documents)
            ? space.documents.length
            : 0,
        subspaceCount: Array.isArray(space.subspaces)
          ? space.subspaces.length
          : 0,
        createdAt: new Date(space.createdAt).toISOString(),
        updatedAt: new Date(space.updatedAt).toISOString(),
      },
    };
    return result;
  },
};

export async function POST(req: Request) {
  const debugRequestId = `chat-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authResult = await verifyAuthToken(authToken);
  if (!authResult.valid) {
    return NextResponse.json(
      { error: 'Unauthorized', reason: authResult.reason },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const messages = parsed.data.messages as unknown as UIMessage[];
  const spaceSlug = parsed.data.spaceSlug;

  if (OPENROUTER_DEBUG) {
    console.log('[chat][openrouter][start]', {
      debugRequestId,
      model: 'openrouter/auto',
      messageCount: messages.length,
      spaceSlug: spaceSlug ?? null,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI SDK tools union triggers TS2589 in CI (explicit ReturnType also fails)
  const getPeopleBySpaceSlugTool: any = createGetPeopleBySpaceSlugTool(req);

  const result = streamText({
    model: openrouter('openrouter/auto'),
    system: buildSystemPrompt(spaceSlug),
    messages: await convertToModelMessages(messages),
    tools: {
      get_space_by_slug: getSpaceBySlugTool,
      get_people_by_space_slug: getPeopleBySpaceSlugTool,
    },
    stopWhen: stepCountIs(6),
    onStepFinish: (event) => {
      if (!OPENROUTER_DEBUG) return;

      console.log('[chat][openrouter][step-finish]', {
        debugRequestId,
        stepNumber: event.stepNumber,
        provider: event.model.provider,
        modelId: event.model.modelId,
        finishReason: event.finishReason,
        responseId: event.response?.id,
        usage: event.usage,
        openrouterProviderMetadata:
          event.providerMetadata &&
          typeof event.providerMetadata === 'object' &&
          'openrouter' in event.providerMetadata
            ? (event.providerMetadata as { openrouter?: unknown }).openrouter
            : undefined,
      });
    },
    onFinish: (event) => {
      if (!OPENROUTER_DEBUG) return;

      const generationId = event.response?.id;
      const generationUrl = generationId
        ? `https://openrouter.ai/api/v1/generation?id=${generationId}`
        : null;

      console.log('[chat][openrouter][finish]', {
        debugRequestId,
        provider: event.model.provider,
        modelId: event.model.modelId,
        responseId: generationId,
        generationUrl,
        finishReason: event.finishReason,
        totalUsage: event.totalUsage,
        warnings: event.warnings,
      });
    },
    onError: ({ error }) => {
      if (isAbortLikeError(error)) {
        if (OPENROUTER_DEBUG) {
          console.warn('[chat][openrouter][abort]', { debugRequestId });
        }
        return;
      }
      console.error('[chat][openrouter][error]', {
        debugRequestId,
        message: error instanceof Error ? error.message : String(error),
        ...(OPENROUTER_DEBUG && { error }),
      });
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      'x-hypha-chat-debug-id': debugRequestId,
    },
    onError: (error) => {
      if (isAbortLikeError(error)) {
        if (OPENROUTER_DEBUG) {
          console.warn('[chat][ui-stream][abort]', { debugRequestId });
        }
        return '';
      }
      console.error('[chat][ui-stream][error]', {
        debugRequestId,
        message: error instanceof Error ? error.message : String(error),
        ...(OPENROUTER_DEBUG && { error }),
      });
      // Non-locale API route — return a generic error code the client can map to a translation.
      // The client-side AiPanel component handles localized display via the 'streamError' i18n key.
      return 'STREAM_ERROR';
    },
  });
}
