import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { TOOLS } from '../descriptions';
import type { McpDeps } from '../deps';
import { presentSpaceDetail, spaceDetailSchema } from '../presentation/spaces';
import { failureText, runTool } from './run-tool';

const P = TOOLS.hypha_get_space.params;

export const getSpaceInput = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .describe(P.slug),
  omitVisibility: z.boolean().optional().describe(P.omitVisibility),
  omitGovernance: z.boolean().optional().describe(P.omitGovernance),
  omitCounts: z.boolean().optional().describe(P.omitCounts),
});

export function registerGetSpace(server: McpServer, deps: McpDeps): void {
  server.registerTool(
    'hypha_get_space',
    {
      title: TOOLS.hypha_get_space.title,
      description: TOOLS.hypha_get_space.description,
      inputSchema: getSpaceInput,
      outputSchema: spaceDetailSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(deps, 'hypha_get_space', async (caller) => {
        const r = await deps.features.getSpace(
          {
            slug: args.slug,
            with: {
              visibility: !(args.omitVisibility ?? false),
              governance: !(args.omitGovernance ?? false),
              counts: !(args.omitCounts ?? false),
            },
          },
          caller,
        );
        if (!r.ok) {
          return { ok: false, text: failureText(r), outcome: r.code };
        }
        return {
          ok: true,
          itemCount: 1,
          result: presentSpaceDetail(r.data, { spaceUrl: deps.spaceUrl }),
        };
      }),
  );
}
