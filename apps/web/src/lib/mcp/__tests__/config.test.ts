import { describe, expect, it } from 'vitest';
import { allowedScopesForResource } from '@hypha-platform/auth-server/server';
import { loadMcpConfig, type AuthServerView } from '../config';

const AS: AuthServerView = {
  enabled: true,
  issuer: 'https://auth.example.com',
  resources: ['https://mcp.example.com/mcp'],
  allowedPersonIds: new Set(['p1']),
  scopesForResource: () => ['spaces:read', 'offline_access'],
};

describe('loadMcpConfig', () => {
  it('is off by default and only the exact string "true" turns it on', () => {
    for (const value of [undefined, '', '1', 'TRUE', 'yes']) {
      expect(
        loadMcpConfig({ MCP_SERVER_ENABLED: value }, AS).active,
      ).toBeNull();
    }
    expect(
      loadMcpConfig({ MCP_SERVER_ENABLED: 'true' }, AS).active,
    ).not.toBeNull();
  });

  it('the kill switch wins', () => {
    const c = loadMcpConfig(
      { MCP_SERVER_ENABLED: 'true', MCP_SERVER_KILL_SWITCH: 'true' },
      AS,
    );
    expect(c.active).toBeNull();
    expect(c.reason).toContain('kill switch');
  });

  it('is off outside production (Preview shares production data)', () => {
    for (const env of ['preview', 'development']) {
      expect(
        loadMcpConfig({ MCP_SERVER_ENABLED: 'true', VERCEL_ENV: env }, AS)
          .active,
      ).toBeNull();
    }
    expect(
      loadMcpConfig(
        { MCP_SERVER_ENABLED: 'true', VERCEL_ENV: 'production' },
        AS,
      ).active,
    ).not.toBeNull();
  });

  it('needs the authorization server and a /mcp resource', () => {
    expect(
      loadMcpConfig({ MCP_SERVER_ENABLED: 'true' }, { enabled: false }).active,
    ).toBeNull();
    expect(
      loadMcpConfig(
        { MCP_SERVER_ENABLED: 'true' },
        { ...AS, resources: ['https://x.example.com/api/v2'] },
      ).active,
    ).toBeNull();
  });

  it('takes host, audience and metadata URL from the resource string, exactly', () => {
    const c = loadMcpConfig({ MCP_SERVER_ENABLED: 'true' }, AS);
    expect(c.host).toBe('mcp.example.com');
    expect(c.active).toMatchObject({
      audience: 'https://mcp.example.com/mcp',
      issuer: 'https://auth.example.com',
      resourceMetadataUrl:
        'https://mcp.example.com/.well-known/oauth-protected-resource/mcp',
    });
  });

  it('advertises exactly the scopes the authorization server lists for the selected resource', () => {
    expect(
      loadMcpConfig({ MCP_SERVER_ENABLED: 'true' }, AS).active?.scopesSupported,
    ).toEqual(['spaces:read', 'offline_access']);
    const asked: string[] = [];
    const withWrites: AuthServerView = {
      ...AS,
      resources: ['https://api.example.com/v2', 'https://mcp.example.com/mcp'],
      scopesForResource: (resource) => {
        asked.push(resource);
        return ['spaces:read', 'offline_access', 'signals:write'];
      },
    };
    expect(
      loadMcpConfig({ MCP_SERVER_ENABLED: 'true' }, withWrites).active
        ?.scopesSupported,
    ).toEqual(['spaces:read', 'offline_access', 'signals:write']);
    expect(asked).toEqual(['https://mcp.example.com/mcp']);
  });

  it('a resource the authorization server does not treat as MCP never advertises signals:write', () => {
    const real: AuthServerView = {
      ...AS,
      resources: ['https://mcp.example.com/v2/mcp'],
      scopesForResource: (resource) =>
        allowedScopesForResource(resource, { mcpWritesEnabled: true }),
    };
    expect(
      loadMcpConfig({ MCP_SERVER_ENABLED: 'true' }, real).active
        ?.scopesSupported,
    ).not.toContain('signals:write');
  });

  it('while off with no resource configured, it still knows its own host (so the unavailable answer works)', () => {
    expect(loadMcpConfig({}, { enabled: false }).host).toBe('mcp.hypha.earth');
  });
});
