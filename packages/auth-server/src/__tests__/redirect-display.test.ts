import { describe, it, expect } from 'vitest';
import { describeRedirect, redirectHostForLog } from '../redirect-display';

describe('describeRedirect: how the consent page names where the person is sent back to', () => {
  it('https: the host, as before', () => {
    expect(describeRedirect('https://claude.ai/api/mcp/auth_callback')).toEqual(
      { kind: 'web', display: 'claude.ai' },
    );
  });

  it('loopback: an app on this computer, never a host or a port', () => {
    for (const value of [
      'http://127.0.0.1:33418/callback',
      'http://127.0.0.1/callback',
      'http://localhost:6274/cb',
      'http://LOCALHOST:8787/callback',
      'http://[::1]:43554/callback',
      'https://localhost:3000/cb',
    ]) {
      expect(describeRedirect(value)).toEqual({ kind: 'local', display: '' });
    }
  });

  it('a host that only looks local stays a website, with its port', () => {
    expect(describeRedirect('http://localhost.evil.example:80/cb')).toEqual({
      kind: 'web',
      display: 'localhost.evil.example',
    });
    expect(describeRedirect('https://127.0.0.1.nip.io/cb').kind).toBe('web');
    expect(describeRedirect('https://app.example:8443/cb')).toEqual({
      kind: 'web',
      display: 'app.example:8443',
    });
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
