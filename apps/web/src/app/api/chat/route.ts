import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import type { UIMessage } from 'ai';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 30;

const BASE_SYSTEM_PROMPT =
  'You are Hypha AI, a helpful assistant for the Hypha DAO platform. You help users analyze signals, draft proposals, understand community dynamics, and coordinate across spaces. Be concise and helpful.';

function buildSystemPrompt(spaceSlug?: string | null): string {
  if (spaceSlug) {
    return `${BASE_SYSTEM_PROMPT}\n\nThe user is currently viewing the space with slug "${spaceSlug}". Use the get_space_by_slug tool when you need space details (members, documents, description, etc.) to give context-aware answers.`;
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
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
