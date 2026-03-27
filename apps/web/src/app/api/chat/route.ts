import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';
import type { UIMessage } from 'ai';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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

function buildSystemPrompt(spaceSlug?: string | null): string {
  if (spaceSlug) {
    return `${BASE_SYSTEM_PROMPT}\n\nThe user is currently viewing the space with slug "${spaceSlug}". Use the get_space_by_slug tool to answer space-specific questions about space metadata, members, and structure.`;
  }
  return BASE_SYSTEM_PROMPT;
}

const getSpaceBySlugTool = tool({
  description:
    'Returns a single Hypha space and summary counts for members, documents, and subspaces. Use this when the user asks about a space, its members, agreements, or structure.',
  inputSchema: z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug, for example "hypha"'),
  }),
  execute: async ({ slug }) => {
    const space = await getSpaceBySlug({ slug });
    if (!space) {
      return { found: false, slug, space: null };
    }
    return {
      found: true,
      slug,
      space: {
        id: space.id,
        slug: space.slug,
        title: space.title,
        description: space.description ?? null,
        parentId: space.parentId ?? null,
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
  },
});

export async function POST(req: Request) {
  const debugRequestId = `chat-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    messages,
    spaceSlug,
  }: {
    messages: UIMessage[];
    spaceSlug?: string | null;
  } = await req.json();

  if (OPENROUTER_DEBUG) {
    console.log('[chat][openrouter][start]', {
      debugRequestId,
      model: 'openrouter/auto',
      messageCount: messages.length,
      spaceSlug: spaceSlug ?? null,
    });
  }

  const result = streamText({
    model: openrouter('openrouter/auto'),
    system: buildSystemPrompt(spaceSlug),
    messages: await convertToModelMessages(messages),
    tools: {
      get_space_by_slug: getSpaceBySlugTool,
    },
    stopWhen: stepCountIs(5),
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
        error,
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
        error,
      });
      return 'An error occurred while generating the response.';
    },
  });
}
