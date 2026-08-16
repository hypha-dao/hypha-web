import { describe, expect, it } from 'vitest';
import {
  bindIbaMemoryToolAccess,
  bindStdioMemoryToolAccess,
  memoryPublishDenied,
} from '../memory-tool-context';

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
});

describe('memoryPublishDenied', () => {
  it('blocks publish when the caller cannot publish', () => {
    expect(memoryPublishDenied('publish', false)).toMatch(/cannot publish/);
    expect(memoryPublishDenied('draft', false)).toBeUndefined();
    expect(memoryPublishDenied('publish', true)).toBeUndefined();
  });
});

describe('bindStdioMemoryToolAccess', () => {
  it('requires space_slug', () => {
    const result = bindStdioMemoryToolAccess()({ write: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('space_slug');
    }
  });
});
