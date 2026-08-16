import { afterEach, describe, expect, it } from 'vitest';
import { IBA_CANNOT_PUBLISH } from '@hypha-platform/core/intelligence';
import {
  bindIbaMemoryToolAccess,
  bindStdioMemoryToolAccess,
  IBA_MEMORY_MCP_TOOLS,
  memoryPublishDenied,
} from '../memory-tool-context';
import { MCP_INTELLIGENCE_SOURCE_APP_FALLBACK } from '../memory-write-identity';

describe('IBA_MEMORY_MCP_TOOLS', () => {
  it('exposes only the hosted memory CRUD allowlist', () => {
    expect([...IBA_MEMORY_MCP_TOOLS]).toEqual([
      'memory.list',
      'memory.search',
      'memory.read',
      'memory.create',
      'memory.update',
      'memory.delete',
    ]);
    expect(IBA_MEMORY_MCP_TOOLS).not.toContain('memory.enable_pack');
  });
});

describe('bindIbaMemoryToolAccess', () => {
  const bind = bindIbaMemoryToolAccess({
    spaceSlug: 'belica-5-0',
    sourceApp: 'stakeholder-protocol',
    scopes: ['intelligence:write'],
  });

  it('infers the key space when space_slug is omitted', () => {
    const result = bind({ write: false });
    expect(result).toEqual({
      ok: true,
      access: {
        spaceSlug: 'belica-5-0',
        skipMembershipCheck: true,
        canonicalSourceApp: 'stakeholder-protocol',
        allowPublish: false,
      },
    });
  });

  it('rejects a space_slug that does not match the key', () => {
    const result = bind({ spaceSlug: 'other-space', write: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('other-space');
    }
  });

  it('rejects writes when the key only has intelligence:read', () => {
    const readOnly = bindIbaMemoryToolAccess({
      spaceSlug: 'belica-5-0',
      sourceApp: 'stakeholder-protocol',
      scopes: ['intelligence:read'],
    });
    const result = readOnly({ write: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('intelligence:write');
    }
  });

  it('rejects a spoofed source_app', () => {
    const result = bind({
      write: true,
      claimedSourceApp: 'hypha-mcp',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('hypha-mcp');
    }
  });

  it('allows writes on the key space without publish', () => {
    const result = bind({ spaceSlug: 'belica-5-0', write: true });
    expect(result).toEqual({
      ok: true,
      access: {
        spaceSlug: 'belica-5-0',
        skipMembershipCheck: true,
        canonicalSourceApp: 'stakeholder-protocol',
        allowPublish: false,
      },
    });
  });
});

describe('memoryPublishDenied', () => {
  it('blocks publish when the caller cannot publish', () => {
    expect(memoryPublishDenied('publish', false)).toBe(IBA_CANNOT_PUBLISH);
    expect(memoryPublishDenied('draft', false)).toBeUndefined();
    expect(memoryPublishDenied('propose', false)).toBeUndefined();
    expect(memoryPublishDenied('publish', true)).toBeUndefined();
  });
});

describe('bindStdioMemoryToolAccess', () => {
  const originalAuth = process.env.HYPHA_MCP_AUTH_TOKEN;
  const originalSource = process.env.HYPHA_MCP_SOURCE_APP;

  afterEach(() => {
    if (originalAuth === undefined) {
      delete process.env.HYPHA_MCP_AUTH_TOKEN;
    } else {
      process.env.HYPHA_MCP_AUTH_TOKEN = originalAuth;
    }
    if (originalSource === undefined) {
      delete process.env.HYPHA_MCP_SOURCE_APP;
    } else {
      process.env.HYPHA_MCP_SOURCE_APP = originalSource;
    }
  });

  it('requires space_slug', () => {
    const result = bindStdioMemoryToolAccess()({ write: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('space_slug');
    }
  });

  it('keeps member publish + env identity for local Cursor', () => {
    process.env.HYPHA_MCP_AUTH_TOKEN = 'privy-token';
    process.env.HYPHA_MCP_SOURCE_APP = 'local-cursor';

    const result = bindStdioMemoryToolAccess()({
      spaceSlug: 'belica-5-0',
      write: true,
    });

    expect(result).toEqual({
      ok: true,
      access: {
        spaceSlug: 'belica-5-0',
        skipMembershipCheck: false,
        authToken: 'privy-token',
        canonicalSourceApp: 'local-cursor',
        allowPublish: true,
      },
    });
  });

  it('falls back to hypha-mcp when HYPHA_MCP_SOURCE_APP is unset', () => {
    delete process.env.HYPHA_MCP_AUTH_TOKEN;
    delete process.env.HYPHA_MCP_SOURCE_APP;

    const result = bindStdioMemoryToolAccess()({
      spaceSlug: 'belica-5-0',
      write: false,
    });

    expect(result).toEqual({
      ok: true,
      access: {
        spaceSlug: 'belica-5-0',
        skipMembershipCheck: false,
        authToken: undefined,
        canonicalSourceApp: MCP_INTELLIGENCE_SOURCE_APP_FALLBACK,
        allowPublish: true,
      },
    });
  });

  it('rejects a spoofed source_app against env identity', () => {
    process.env.HYPHA_MCP_SOURCE_APP = 'local-cursor';
    const result = bindStdioMemoryToolAccess()({
      spaceSlug: 'belica-5-0',
      write: true,
      claimedSourceApp: 'evil-app',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('evil-app');
    }
  });
});
