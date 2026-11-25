import { describe, expect, it } from 'vitest';
import * as schema from '@hypha-platform/storage-postgres';
import {
  CLIENT_ID_REQUIRED_ORIGIN_KINDS,
  CLIENT_LESS_ORIGIN_KINDS,
  ORIGIN_CLIENT_ID_MAX,
  ORIGIN_CLIENT_LABEL_MAX,
  ORIGIN_KINDS,
} from '../kinds';
import {
  apiClientOrigin,
  appOrigin,
  assertOrigin,
  hyphaAssistantOrigin,
  isAiOrigin,
  jobOrigin,
  mcpClientOrigin,
  originToColumns,
  originViewFromColumns,
  platformOrigin,
  spaceKeyOrigin,
  splitOriginColumns,
  unknownOrigin,
  type Origin,
} from '../origin';

describe('origin kinds', () => {
  it('mirror the database list exactly', () => {
    expect([...ORIGIN_KINDS]).toEqual([...schema.ORIGIN_KINDS]);
    expect([...CLIENT_LESS_ORIGIN_KINDS]).toEqual([
      ...schema.CLIENT_LESS_ORIGIN_KINDS,
    ]);
    expect([...CLIENT_ID_REQUIRED_ORIGIN_KINDS]).toEqual([
      ...schema.CLIENT_ID_REQUIRED_ORIGIN_KINDS,
    ]);
    expect(ORIGIN_CLIENT_ID_MAX).toBe(schema.ORIGIN_CLIENT_ID_MAX);
    expect(ORIGIN_CLIENT_LABEL_MAX).toBe(schema.ORIGIN_CLIENT_LABEL_MAX);
  });
});

describe('origin constructors', () => {
  it('builds one origin per path', () => {
    expect(appOrigin()).toMatchObject({ kind: 'app', clientId: null });
    expect(hyphaAssistantOrigin()).toMatchObject({
      kind: 'hypha_assistant',
      clientId: null,
      clientLabel: null,
    });
    expect(
      mcpClientOrigin({
        clientId: 'https://c.example/id.json',
        clientName: ' Claude ',
      }),
    ).toMatchObject({
      kind: 'mcp_client',
      clientId: 'https://c.example/id.json',
      clientLabel: 'Claude',
    });
    expect(
      apiClientOrigin({ clientId: 'kit-app', clientName: 'Kit' }).kind,
    ).toBe('api_client');
    expect(spaceKeyOrigin({ keyId: 7, source: 'acaw-contest' })).toMatchObject({
      kind: 'space_key',
      clientId: '7',
      clientLabel: 'acaw-contest',
    });
    expect(jobOrigin('signal-orchestrator')).toMatchObject({
      kind: 'hypha_intelligence',
      clientId: 'signal-orchestrator',
      clientLabel: 'signal-orchestrator',
    });
    expect(platformOrigin('proposal-executed-webhook')).toMatchObject({
      kind: 'hypha_platform',
      clientId: null,
      clientLabel: 'proposal-executed-webhook',
    });
    expect(unknownOrigin().kind).toBe('unknown');
  });

  it('cleans a self-declared name and caps it', () => {
    const origin = mcpClientOrigin({
      clientId: 'c',
      clientName: `  A\u0000\n  B ${'x'.repeat(500)}`,
    });
    expect(origin.clientLabel?.length).toBeLessThanOrEqual(
      ORIGIN_CLIENT_LABEL_MAX,
    );
    expect(origin.clientLabel?.startsWith('A B x')).toBe(true);
    expect(
      mcpClientOrigin({ clientId: 'c', clientName: '   ' }).clientLabel,
    ).toBeNull();
  });

  it('does not cut an emoji in half when capping a name', () => {
    const name = 'a'.repeat(ORIGIN_CLIENT_LABEL_MAX - 1) + '😀😀';
    const origin = mcpClientOrigin({ clientId: 'c', clientName: name });
    expect(origin.clientLabel).toBe(
      'a'.repeat(ORIGIN_CLIENT_LABEL_MAX - 1) + '😀',
    );
    expect(() => assertOrigin(origin)).not.toThrow();
    const emojiOnly = mcpClientOrigin({
      clientId: 'c',
      clientName: '😀'.repeat(300),
    });
    expect(Array.from(emojiOnly.clientLabel ?? '')).toHaveLength(
      ORIGIN_CLIENT_LABEL_MAX,
    );
    expect(() => assertOrigin(emojiOnly)).not.toThrow();
  });

  it('needs a client id where the kind requires one, and caps it', () => {
    expect(() => mcpClientOrigin({ clientId: '  ' })).toThrow();
    expect(() => spaceKeyOrigin({ keyId: '', source: 's' })).toThrow();
    expect(() =>
      mcpClientOrigin({ clientId: 'x'.repeat(ORIGIN_CLIENT_ID_MAX + 1) }),
    ).toThrow();
  });

  it('is plain serializable data', () => {
    const origin = mcpClientOrigin({ clientId: 'c', clientName: 'n' });
    expect(JSON.parse(JSON.stringify(origin))).toEqual({
      kind: 'mcp_client',
      clientId: 'c',
      clientLabel: 'n',
    });
  });

  it('cannot be built from a plain object at compile time', () => {
    // @ts-expect-error a plain object is not an Origin: only the constructors brand it
    const forged: Origin = { kind: 'app', clientId: null, clientLabel: null };
    expect(forged.kind).toBe('app');
  });
});

describe('assertOrigin', () => {
  it('rejects values the database CHECK would reject', () => {
    expect(() => assertOrigin(undefined)).toThrow(/required/);
    expect(() => assertOrigin({ kind: 'admin' })).toThrow(
      /Unknown origin kind/,
    );
    expect(() =>
      assertOrigin({ kind: 'app', clientId: 'x', clientLabel: null }),
    ).toThrow(/no client/);
    expect(() =>
      assertOrigin({ kind: 'space_key', clientId: null, clientLabel: 'x' }),
    ).toThrow(/needs a client id/);
    expect(() =>
      assertOrigin({
        kind: 'hypha_platform',
        clientId: null,
        clientLabel: 'x'.repeat(121),
      }),
    ).toThrow();
  });

  it('accepts what the constructors build', () => {
    for (const origin of [
      appOrigin(),
      hyphaAssistantOrigin(),
      mcpClientOrigin({ clientId: 'c' }),
      spaceKeyOrigin({ keyId: 1, source: 's' }),
      jobOrigin('job'),
      platformOrigin('hook'),
      unknownOrigin(),
    ]) {
      expect(assertOrigin(origin)).toEqual(origin);
    }
  });
});

describe('origin columns', () => {
  it('maps to the three columns', () => {
    expect(
      originToColumns(spaceKeyOrigin({ keyId: 3, source: 'app' })),
    ).toEqual({
      originKind: 'space_key',
      originClientId: '3',
      originClientLabel: 'app',
    });
  });

  it('comes back as a separate part, without the client id', () => {
    const row = {
      id: 1,
      title: 't',
      originKind: 'mcp_client' as const,
      originClientId: 'secret-ish-id',
      originClientLabel: 'Claude',
    };
    const { entity, origin } = splitOriginColumns(row);
    // Database rows type the kind as a plain string.
    splitOriginColumns({ ...row, originKind: 'mcp_client' as string });
    expect(entity).toEqual({ id: 1, title: 't' });
    expect(origin).toEqual({ kind: 'mcp_client', clientLabel: 'Claude' });
  });

  it('reads a value outside the list as unknown', () => {
    expect(originViewFromColumns({ originKind: 'weird' }).kind).toBe('unknown');
    expect(originViewFromColumns({}).kind).toBe('unknown');
  });

  it('marks the AI kinds', () => {
    expect(isAiOrigin({ kind: 'hypha_assistant' })).toBe(true);
    expect(isAiOrigin({ kind: 'hypha_intelligence' })).toBe(true);
    expect(isAiOrigin({ kind: 'mcp_client' })).toBe(true);
    for (const kind of [
      'app',
      'api_client',
      'space_key',
      'hypha_platform',
      'unknown',
    ] as const) {
      expect(isAiOrigin({ kind })).toBe(false);
    }
  });
});
