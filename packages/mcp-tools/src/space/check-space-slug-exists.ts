import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkSpaceSlugExists } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { z } from 'zod';

export const checkSpaceSlugExistsInputSchema = {
  slug: z
    .string()
    .trim()
    .min(1, 'Space slug is required')
    .describe('Hypha space slug, for example "hypha"'),
};

export const checkSpaceSlugExistsOutputSchema = z
  .object({
    exists: z.boolean(),
    slug: z.string(),
    spaceId: z.number().nullable(),
  })
  .strict();

type CheckSpaceSlugExistsStructuredContent = z.infer<
  typeof checkSpaceSlugExistsOutputSchema
>;

export async function handleCheckSpaceSlugExists({
  slug,
}: {
  slug: string;
}): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: CheckSpaceSlugExistsStructuredContent;
}> {
  const { exists, spaceId } = await checkSpaceSlugExists({ slug }, { db });

  const output: CheckSpaceSlugExistsStructuredContent = {
    exists,
    slug,
    spaceId: spaceId ?? null,
  };

  return {
    content: [
      {
        type: 'text',
        text: exists
          ? `Space slug "${slug}" exists (spaceId: ${spaceId}).`
          : `Space slug "${slug}" does not exist.`,
      },
    ],
    structuredContent: output,
  };
}

export function registerCheckSpaceSlugExistsTool(server: McpServer): void {
  server.registerTool(
    'check_space_slug_exists',
    {
      title: 'Check Space Slug Exists',
      description:
        'Checks whether a Hypha space exists for the given slug. Returns exists flag and spaceId when found.',
      inputSchema: checkSpaceSlugExistsInputSchema,
      outputSchema: checkSpaceSlugExistsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleCheckSpaceSlugExists,
  );
}
