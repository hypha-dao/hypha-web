import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import type { UIMessage } from 'ai';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import {
  handleGetDocumentsBySpaceSlug,
  handleGetSpaceProposalsBySpaceSlug,
} from '@hypha-platform/mcp-tools';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 30;

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

function getModel(modelId: string) {
  switch (modelId) {
    case 'gemini-2.5-flash':
      return google('gemini-2.5-flash');
    default:
      return google('gemini-2.5-flash');
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    messages,
    modelId = 'gemini-2.5-flash',
    spaceSlug,
  }: {
    messages: UIMessage[];
    modelId?: string;
    spaceSlug?: string | null;
  } = await req.json();

  const model = getModel(modelId);

  const result = streamText({
    model,
    system: buildSystemPrompt(spaceSlug),
    messages: await convertToModelMessages(messages),
    tools: {
      get_space_by_slug: getSpaceBySlugTool,
      get_documents_by_space_slug: getDocumentsBySpaceSlugTool,
      get_space_proposals_by_space_slug: getSpaceProposalsBySpaceSlugTool,
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
