import 'server-only';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getMemberIntelligence,
  resolveMemberCaller,
  type MemberIntelligence,
} from '@hypha-platform/core/server';
import type { z } from 'zod';

import {
  getMemberConnectionsOutputSchema,
  getMemberIntelligenceOutputSchema,
  getMemberNotificationsOutputSchema,
  getMemberProposalsOutputSchema,
  getMemberSignalsOutputSchema,
  getMemberSpacesOutputSchema,
  getMemberWalletOutputSchema,
  memberToolInputSchema,
} from './member-intelligence-schema.js';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function invalidInput(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Invalid input: ${message}` }],
    isError: true,
  };
}

async function loadMemberIntelligence(
  limit: number,
): Promise<{ intelligence: MemberIntelligence } | { error: string }> {
  try {
    const caller = await resolveMemberCaller(process.env.HYPHA_MCP_AUTH_TOKEN);
    if (!caller) {
      return {
        error:
          'No member for HYPHA_MCP_AUTH_TOKEN. Set a Privy JWT for the signed-in person.',
      };
    }
    const intelligence = await getMemberIntelligence(
      { personId: caller.person.id, limit },
      { db: caller.db },
    );
    if (!intelligence) {
      return { error: 'Member profile could not be loaded.' };
    }
    return { intelligence };
  } catch (error) {
    console.error('[loadMemberIntelligence] failed', error);
    return { error: 'Member profile could not be loaded.' };
  }
}

function registerSlice<T extends z.ZodTypeAny>(
  server: McpServer,
  name: string,
  description: string,
  outputSchema: T,
  pick: (intelligence: MemberIntelligence) => z.infer<T>,
  summarize: (data: z.infer<T>) => string,
) {
  server.registerTool(
    name,
    {
      description,
      inputSchema: memberToolInputSchema,
      outputSchema,
    },
    async (args) => {
      const parsed = memberToolInputSchema.safeParse(args ?? {});
      if (!parsed.success) return invalidInput(parsed.error.message);
      const loaded = await loadMemberIntelligence(parsed.data.limit);
      if ('error' in loaded) {
        return {
          content: [{ type: 'text', text: loaded.error }],
          isError: true,
        };
      }
      const data = pick(loaded.intelligence);
      const out = outputSchema.safeParse(data);
      if (!out.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Internal error: output validation failed: ${out.error.message}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text', text: summarize(out.data) }],
        structuredContent: out.data as Record<string, unknown>,
      };
    },
  );
}

/**
 * User-level intelligence tools. Same registration shape as the space tools:
 * zod input/output schemas, auth via HYPHA_MCP_AUTH_TOKEN, structured content.
 * These never take another person's id — they resolve the caller.
 */
export function registerMemberMcpTools(server: McpServer) {
  registerSlice(
    server,
    'get_member_intelligence',
    'Personal intelligence for the authenticated member: orientation, counts, guidance narrative, attention, spaces, proposals, signals, notifications, connections, wallet, and pending space invites. Use this to walk a member through what needs them.',
    getMemberIntelligenceOutputSchema,
    (intelligence) => intelligence,
    (data) => data.guidance.narrative,
  );

  registerSlice(
    server,
    'get_member_spaces',
    'Spaces the authenticated member belongs to.',
    getMemberSpacesOutputSchema,
    (intelligence) => ({
      spaces: intelligence.spaces,
      count: intelligence.counts.spaces,
    }),
    (data) => `${data.count} spaces.`,
  );

  registerSlice(
    server,
    'get_member_proposals',
    'Open proposals and discussions in the authenticated member spaces.',
    getMemberProposalsOutputSchema,
    (intelligence) => ({
      proposals: intelligence.proposals,
      openProposals: intelligence.counts.openProposals,
    }),
    (data) => `${data.openProposals} open proposals.`,
  );

  registerSlice(
    server,
    'get_member_signals',
    'Active signals in the authenticated member spaces.',
    getMemberSignalsOutputSchema,
    (intelligence) => ({
      signals: intelligence.signals,
      count: intelligence.counts.signals,
    }),
    (data) => `${data.count} signals.`,
  );

  registerSlice(
    server,
    'get_member_notifications',
    'What currently needs the authenticated member, plus the personal guidance narrative.',
    getMemberNotificationsOutputSchema,
    (intelligence) => ({
      notifications: intelligence.notifications,
      attention: intelligence.attention,
      guidance: intelligence.guidance,
    }),
    (data) => data.guidance.narrative,
  );

  registerSlice(
    server,
    'get_member_connections',
    'People who share a space with the authenticated member, and a space slug to open chat.',
    getMemberConnectionsOutputSchema,
    (intelligence) => ({
      connections: intelligence.connections,
      count: intelligence.counts.connections,
      chatSpaceSlug: intelligence.chatSpaceSlug,
    }),
    (data) => `${data.count} people around.`,
  );

  registerSlice(
    server,
    'get_member_wallet',
    'Wallet address and preferred currency for the authenticated member.',
    getMemberWalletOutputSchema,
    (intelligence) => ({ wallet: intelligence.wallet }),
    (data) =>
      data.wallet.address
        ? `Wallet ${data.wallet.address}`
        : 'No wallet address on the profile.',
  );
}
