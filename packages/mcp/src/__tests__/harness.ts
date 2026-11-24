import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createHyphaMcpServer } from '../server';
import type { McpDeps, McpFeatures, ToolCallLog, UserCaller } from '../deps';

export const caller = {
  kind: 'user',
  person: { id: 1 },
  address: '0xabc0000000000000000000000000000000000001',
  via: { clientId: 'c', scopes: ['spaces:read'], spaceGrants: null },
} as unknown as UserCaller;

export const rawSpace = (over: Record<string, unknown> = {}) => ({
  id: 1,
  slug: 'alpha',
  title: 'Alpha',
  description: 'A space',
  parentId: null,
  web3SpaceId: 11,
  flags: [],
  memberCount: 3,
  links: [],
  categories: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
  governance: {
    quorum: 50,
    unity: 60,
    votingPowerSource: 2,
    joinMethod: 0,
  },
  ...over,
});

export function makeDeps(
  over: Partial<McpDeps> = {},
  features: Partial<McpFeatures> = {},
) {
  const logs: ToolCallLog[] = [];
  const deps: McpDeps = {
    access: { kind: 'caller', caller },
    features: {
      listSpaces: async () => ({
        ok: true,
        data: {
          items: [rawSpace()],
          total: 1,
          asOf: '2026-11-19T00:00:00.000Z',
          asOfBlock: 1,
          slugById: new Map([[1, 'alpha']]),
          memberCountByWeb3Id: new Map([[11, 3]]),
        },
      }),
      getSpace: async () => ({
        ok: true,
        data: {
          ...rawSpace(),
          subspaces: [],
          parentSlug: null,
          visibility: { discoverability: 0, access: 0 },
          governance: {
            quorum: 50,
            unity: 60,
            votingPowerSource: 2,
            joinMethod: 0,
          },
          counts: { memberCount: 3 },
          asOf: '2026-11-19T00:00:00.000Z',
          asOfBlock: 1,
        },
      }),
      listProposals: async () => ({
        ok: true,
        data: {
          items: [],
          total: 0,
          asOf: '2026-11-19T00:00:00.000Z',
          asOfBlock: 1,
        },
      }),
      getMyVote: async () => ({
        ok: true,
        data: {
          hasVoted: false,
          vote: null,
          isMember: true,
          isDelegate: false,
          votingPower: '1',
          votingPowerDecimals: 0,
          votingPowerSource: 2,
          canVote: true,
          reason: 'eligible',
          asOf: '2026-11-19T00:00:00.000Z',
          asOfBlock: 1,
        },
      }),
      listSignals: async () => ({
        ok: true,
        data: {
          items: [],
          total: 0,
          summary: null,
          asOf: '2026-11-19T00:00:00.000Z',
        },
      }),
      listQuests: async () => ({
        ok: true,
        data: {
          items: [],
          total: 0,
          counts: {
            active: 0,
            proposed: 0,
            paused: 0,
            completed: 0,
            archived: 0,
            total: 0,
          },
          asOf: '2026-11-19T00:00:00.000Z',
        },
      }),
      getMyMembership: async () => ({
        ok: true,
        data: {
          isMember: true,
          isDelegate: false,
          asOf: '2026-11-19T00:00:00.000Z',
          asOfBlock: 1,
        },
      }),
      ...features,
    } as McpFeatures,
    spaceUrl: (slug) => `https://app.example/en/dho/${slug}/overview`,
    proposalUrl: (space, slug) =>
      `https://app.example/en/dho/${space}/agreements/proposal/${slug}`,
    signalUrl: (space, slug) =>
      `https://app.example/en/dho/${space}/coherence?signal=${slug}`,
    questUrl: (space, slug) =>
      `https://app.example/en/dho/${space}/quests/${slug}`,
    log: (entry) => logs.push(entry),
    ...over,
  };
  return { deps, logs };
}

export async function connect(deps: McpDeps) {
  const server = createHyphaMcpServer(deps);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientSide);
  return { client, close: () => client.close() };
}
