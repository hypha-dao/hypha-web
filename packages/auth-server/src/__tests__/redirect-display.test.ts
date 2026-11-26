import { describe, it, expect } from 'vitest';
import { describeRedirect, redirectHostForLog } from '../redirect-display';

describe('describeRedirect: how the consent page names where the person is sent back to', () => {
  it('https: the host, as before', () => {
    expect(describeRedirect('https://claude.ai/api/mcp/auth_callback')).toEqual(
      { kind: 'web', display: 'claude.ai' },
    );
  });

  it('loopback http: host and port', () => {
    expect(describeRedirect('http://127.0.0.1:33418/callback')).toEqual({
      kind: 'web',
      display: '127.0.0.1:33418',
    });
    expect(describeRedirect('http://localhost:6274/cb').display).toBe(
      'localhost:6274',
    );
  });

  it('custom scheme with a host: scheme and host, never empty', () => {
    expect(
      describeRedirect('cursor://anysphere.cursor-mcp/oauth/callback'),
    ).toEqual({ kind: 'app', display: 'cursor://anysphere.cursor-mcp' });
  });

  it('custom scheme without a host: scheme and path, never empty', () => {
    expect(describeRedirect('com.example.app:/oauth2redirect')).toEqual({
      kind: 'app',
      display: 'com.example.app:oauth2redirect',
    });
    expect(describeRedirect('app:cb').display).toBe('app:cb');
    expect(describeRedirect('app:/').display).toBe('app:');
  });

  it('not a URL: empty, no throw', () => {
    expect(describeRedirect('nope').display).toBe('');
    expect(describeRedirect(null).display).toBe('');
  });
});

describe('redirectHostForLog: host only', () => {
  it('never carries a path, query or credentials', () => {
    expect(redirectHostForLog('https://a.example/cb?code=SECRET#x')).toBe(
      'a.example',
    );
    expect(
      redirectHostForLog('cursor://anysphere.cursor-mcp/oauth/callback?x=1'),
    ).toBe('anysphere.cursor-mcp');
    expect(redirectHostForLog('app:/path/secret')).toBe('app:');
    expect(redirectHostForLog('')).toBe('');
  });
});
