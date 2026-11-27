import { describe, it, expect } from 'vitest';
import {
  CURSOR_CLIENT_ID,
  REGISTERED_CLIENTS,
  isAcceptableRegisteredRedirect,
  registeredClientUpsert,
  seedRegisteredClients,
} from '../registered-clients';
import { AUTH_SERVER_SCOPES } from '../config';
import { classifyClient } from '../consent';
import { isAcceptableRedirectUri } from '../registration';

describe('registered clients', () => {
  it('Cursor: stable public id, the documented redirect, read, signal creation and offline_access', () => {
    const cursor = REGISTERED_CLIENTS.find(
      (c) => c.clientId === CURSOR_CLIENT_ID,
    );
    expect(CURSOR_CLIENT_ID).toBe('hypha-cursor');
    expect(cursor).toBeDefined();
    expect(cursor!.redirectUris).toEqual([
      'cursor://anysphere.cursor-mcp/oauth/callback',
    ]);
    expect([...cursor!.scopes].sort()).toEqual([
      'offline_access',
      'signals:write',
      'spaces:read',
    ]);
  });

  it('every listed client is valid: known scopes, no write scope, acceptable redirects, unique ids', () => {
    const ids = new Set<string>();
    for (const c of REGISTERED_CLIENTS) {
      expect(ids.has(c.clientId)).toBe(false);
      ids.add(c.clientId);
      for (const s of c.scopes)
        expect((AUTH_SERVER_SCOPES as readonly string[]).includes(s)).toBe(
          true,
        );
      expect(c.scopes).not.toContain('agreements:vote');
      for (const r of c.redirectUris)
        expect(isAcceptableRegisteredRedirect(r)).toBe(true);
    }
  });

  it('the custom scheme is allowed here only: dynamic registration still refuses it', () => {
    const uri = 'cursor://anysphere.cursor-mcp/oauth/callback';
    expect(isAcceptableRegisteredRedirect(uri)).toBe(true);
    expect(isAcceptableRedirectUri(uri)).toBe(false);
    for (const bad of [
      'javascript:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html,x',
      'blob:https://a.example/x',
      'file:///etc/passwd',
      'about:blank',
      'JavaScript:alert(1)',
    ])
      expect(isAcceptableRegisteredRedirect(bad)).toBe(false);
    expect(isAcceptableRegisteredRedirect('http://evil.example/cb')).toBe(
      false,
    );
    expect(isAcceptableRegisteredRedirect('http://127.0.0.1:1/cb')).toBe(true);
    expect(isAcceptableRegisteredRedirect('https://a.example/cb#x')).toBe(
      false,
    );
  });

  it('the upsert writes a public PKCE client with the registered marker and no secret', () => {
    const q = registeredClientUpsert(REGISTERED_CLIENTS[0]!);
    expect(q.text).toContain(`'none'`);
    expect(q.text).toContain('"requirePKCE"');
    expect(q.text).toContain(`"clientSecret" = null`);
    expect(q.text).toContain('on conflict ("clientId")');
    const marker = JSON.parse(q.values[4] as string);
    expect(classifyClient({ registration: marker.registration })).toBe(
      'registered',
    );
    expect(q.values[0]).toBe(CURSOR_CLIENT_ID);
  });

  it('seeding runs one statement per client and nothing else', async () => {
    const seen: string[] = [];
    await seedRegisteredClients({
      db: {
        query: (async (text: string) => {
          seen.push(text);
          return { rows: [] };
        }) as never,
      },
    });
    expect(seen).toHaveLength(REGISTERED_CLIENTS.length);
  });
});
