import { resolveCanonicalSourceApp } from '@hypha-platform/core/intelligence';
import { mcpAuthToken, resolveMcpSourceApp } from './memory-write-identity.js';

export const IBA_MEMORY_MCP_TOOLS = [
  'memory.list',
  'memory.search',
  'memory.read',
  'memory.create',
  'memory.update',
  'memory.delete',
] as const;

export type IbaMemoryMcpTool = (typeof IBA_MEMORY_MCP_TOOLS)[number];

export type MemoryToolAccess = {
  spaceSlug: string;
  skipMembershipCheck: boolean;
  authToken?: string;
  canonicalSourceApp: string;
  allowPublish: boolean;
};

export type MemoryToolAccessResult =
  | { ok: true; access: MemoryToolAccess }
  | { ok: false; message: string };

export type ResolveMemoryToolAccessInput = {
  spaceSlug?: string;
  claimedSourceApp?: string;
  write: boolean;
};

export type MemoryToolContext = {
  resolveAccess: (
    input: ResolveMemoryToolAccessInput,
  ) => Promise<MemoryToolAccessResult>;
};

export function memoryPublishDenied(
  mode: string | undefined,
  allowPublish: boolean,
): string | undefined {
  if (mode === 'publish' && !allowPublish) {
    return 'Intelligence API keys cannot publish; create a draft instead.';
  }
  return undefined;
}

export function bindIbaMemoryToolAccess(input: {
  spaceSlug: string;
  sourceApp: string;
  scopes: readonly string[];
}): (args: ResolveMemoryToolAccessInput) => MemoryToolAccessResult {
  return ({ spaceSlug, claimedSourceApp, write }) => {
    const requested = spaceSlug?.trim();
    if (requested && requested !== input.spaceSlug) {
      return {
        ok: false,
        message: `This API key is not valid for space "${requested}".`,
      };
    }
    if (write && !input.scopes.includes('intelligence:write')) {
      return {
        ok: false,
        message: 'This API key is missing the "intelligence:write" scope.',
      };
    }
    const identity = resolveCanonicalSourceApp({
      claimed: claimedSourceApp,
      configured: input.sourceApp,
      fallback: input.sourceApp,
    });
    if (!identity.ok) return identity;
    return {
      ok: true,
      access: {
        spaceSlug: input.spaceSlug,
        skipMembershipCheck: true,
        canonicalSourceApp: identity.source_app,
        allowPublish: false,
      },
    };
  };
}

export function bindStdioMemoryToolAccess(): (
  args: ResolveMemoryToolAccessInput,
) => MemoryToolAccessResult {
  return ({ spaceSlug, claimedSourceApp }) => {
    const resolvedSlug = spaceSlug?.trim();
    if (!resolvedSlug) {
      return { ok: false, message: 'space_slug is required.' };
    }
    const identity = resolveMcpSourceApp(claimedSourceApp);
    if (!identity.ok) return identity;
    return {
      ok: true,
      access: {
        spaceSlug: resolvedSlug,
        skipMembershipCheck: false,
        authToken: mcpAuthToken(),
        canonicalSourceApp: identity.source_app,
        allowPublish: true,
      },
    };
  };
}

export function createIbaMemoryToolContext(input: {
  spaceSlug: string;
  sourceApp: string;
  scopes: readonly string[];
}): MemoryToolContext {
  const bind = bindIbaMemoryToolAccess(input);
  return {
    resolveAccess: async (args) => bind(args),
  };
}

export function createStdioMemoryToolContext(): MemoryToolContext {
  const bind = bindStdioMemoryToolAccess();
  return {
    resolveAccess: async (args) => bind(args),
  };
}
