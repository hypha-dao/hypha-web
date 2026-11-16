// temp(mcp) #2559: HTTP side of the MCP server, for tokens issued by our authorization server (#2608).
// Throwaway reference for the final implementation: not meant to merge as is.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/** What the tool needs from Hypha. Injected so the tests need no database or chain. */
export type McpDeps = {
  /** Person for an authorization-server `sub` (people.sub), or null when there is no profile. */
  findPerson: (sub: string) => Promise<McpPerson | null>;
  /** The shared v2 read, run as that person. */
  readMembership: (input: { spaceSlug: string; person: McpPerson }) => Promise<
    | {
        ok: true;
        body: {
          isMember: boolean | null;
          isDelegate: boolean | null;
          asOf: string;
        };
      }
    | { ok: false; status: number; error: string; message?: string }
  >;
};

export type McpPerson = {
  name?: string | null;
  surname?: string | null;
  slug: string;
  address?: string | null;
};

const text = (value: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  ...(isError ? { isError: true } : {}),
});

/**
 * One server per request (stateless). `sub` comes only from the verified token: no tool takes a
 * person parameter, and the token itself never reaches this code.
 */
export function createHyphaMcpServer(sub: string, deps: McpDeps): McpServer {
  const server = new McpServer(
    { name: 'hypha', version: '0.0.0' },
    {
      instructions:
        'Answers about the person who connected this app, read-only. Every result says whose it is.',
    },
  );

  server.registerTool(
    'my_space_membership',
    {
      description:
        'Whether YOU (the person who connected this app) are a member or delegate of a Hypha space. Answers only for the connected person; there is no person parameter.',
      inputSchema: { spaceSlug: z.string().min(1).max(200) },
    },
    async ({ spaceSlug }) => {
      const person = await deps.findPerson(sub);
      if (!person) {
        return text(
          {
            error: 'profile_required',
            message:
              'The connected account has no Hypha profile yet. Create one at hypha.earth first.',
          },
          true,
        );
      }
      const result = await deps.readMembership({ spaceSlug, person });
      if (!result.ok) {
        return text(
          {
            error: result.error,
            ...(result.message && { message: result.message }),
          },
          true,
        );
      }
      return text({
        for: {
          name: [person.name, person.surname].filter(Boolean).join(' ') || null,
          slug: person.slug,
        },
        space: spaceSlug,
        isMember: result.body.isMember,
        isDelegate: result.body.isDelegate,
        asOf: result.body.asOf,
      });
    },
  );
  return server;
}
