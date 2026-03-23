import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';
import type { UIMessage } from 'ai';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import {
  handleGetDocumentsBySpaceSlug,
  handleGetSpaceProposalsBySpaceSlug,
  handleGetTokensBySpaceSlug,
} from '@hypha-platform/mcp-tools';
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
  'You are Hypha AI, a helpful assistant for the Hypha DAO platform. You help users analyze signals, draft proposals, understand community dynamics, and coordinate across spaces. Be concise and helpful.';

function buildSystemPrompt(spaceSlug?: string | null): string {
  if (spaceSlug) {
    return `${BASE_SYSTEM_PROMPT}\n\nThe user is currently viewing the space with slug "${spaceSlug}". Use tools to answer space-specific questions: get_space_by_slug for space metadata, get_documents_by_space_slug (including state="agreement") for agreements/documents, and get_space_proposals_by_space_slug for proposals.`;
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

const getDocumentsBySpaceSlugTool = tool({
  description:
    'Returns paginated governance documents for a Hypha space slug, with optional state filter and search. Use state="agreement" to list agreements.',
  inputSchema: z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug, for example "hypha"'),
    page: z.number().int().min(1).optional().describe('Page number (1-based)'),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('Page size (default 20, max 50)'),
    state: z
      .enum(['discussion', 'proposal', 'agreement'])
      .optional()
      .describe('Filter by document state'),
    searchTerm: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Full-text search on title and description'),
  }),
  execute: async ({ slug, page, pageSize, state, searchTerm }) => {
    const result = await handleGetDocumentsBySpaceSlug({
      slug,
      page,
      pageSize,
      state,
      searchTerm,
    });
    return result.structuredContent;
  },
});

const getSpaceProposalsBySpaceSlugTool = tool({
  description:
    'Returns proposal IDs and indexed proposal documents for a Hypha space slug, grouped by accepted/rejected/on-voting status.',
  inputSchema: z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug, for example "hypha"'),
  }),
  execute: async ({ slug }) => {
    const result = await handleGetSpaceProposalsBySpaceSlug({ slug });
    return result.structuredContent;
  },
});

function createGetTokensTool(spaceSlug: string | null | undefined) {
  return tool({
    description:
      'Lists Hypha tokens for the current space from the database with optional name/symbol search. Only works when the user is viewing a space (space context is sent with the chat request).',
    inputSchema: z.object({
      search: z
        .string()
        .trim()
        .optional()
        .describe('Optional search across token name and symbol'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Maximum tokens to return (default 100, max 200)'),
    }),
    execute: async ({ search, limit }) => {
      const slug = spaceSlug?.trim();
      if (!slug) {
        return {
          spaceFound: false,
          slug: '',
          tokens: [],
          appliedLimit: Math.min(limit ?? 100, 200),
        };
      }
      const result = await handleGetTokensBySpaceSlug({ slug, search, limit });
      return result.structuredContent;
    },
  });
}

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
      get_documents_by_space_slug: getDocumentsBySpaceSlugTool,
      get_space_proposals_by_space_slug: getSpaceProposalsBySpaceSlugTool,
      get_tokens: createGetTokensTool(spaceSlug),
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
