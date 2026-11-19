import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { TOOLS } from '../descriptions';
import type { McpDeps } from '../deps';
import { failureText, runTool } from './run-tool';

export const getMyMembershipInput = z.object({
  spaceSlug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .describe(TOOLS.hypha_get_my_membership.params.spaceSlug),
});

export const getMyMembershipOutput = z.object({
  isMember: z.boolean().nullable(),
  isDelegate: z.boolean().nullable(),
  asOf: z.string(),
});

export function registerGetMyMembership(
  server: McpServer,
  deps: McpDeps,
): void {
  server.registerTool(
    'hypha_get_my_membership',
    {
      title: TOOLS.hypha_get_my_membership.title,
      description: TOOLS.hypha_get_my_membership.description,
      inputSchema: getMyMembershipInput,
      outputSchema: getMyMembershipOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(deps, 'hypha_get_my_membership', async (caller) => {
        const r = await deps.features.getMyMembership(
          { spaceSlug: args.spaceSlug },
          caller,
        );
        if (!r.ok) {
          return { ok: false, text: failureText(r), outcome: r.code };
        }
        const { isMember, isDelegate, asOf } = r.data;
        return { ok: true, result: { isMember, isDelegate, asOf } };
      }),
  );
}
