import { describe, expect, it, vi } from 'vitest';

vi.mock('../../network/capital-columns', () => ({
  writeCoherenceCapitals: vi.fn(),
  attachCoherenceCapitals: vi.fn(),
}));

import { createCoherence } from '../server/mutations';
import { appOrigin, spaceKeyOrigin, type Origin } from '../../origin';
import type { CreateCoherenceInput } from '../types';

/** A database that records the values of the one insert and echoes them back as the row. */
function captureDb() {
  const captured: { values?: Record<string, unknown> } = {};
  const db = {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        captured.values = values;
        return {
          returning: async () => [{ id: 1, ...values }],
        };
      },
    }),
  };
  return { db: db as never, captured };
}

// `spaceId: null` skips the space and workflow lookups; only the insert is under test.
const baseInput = {
  creatorId: 5,
  spaceId: null as never,
  type: 'Need',
  priority: 'medium',
  title: 'We need clean water',
  description: 'The well is dry.',
  archived: false,
  tags: [],
} satisfies CreateCoherenceInput;

describe('createCoherence origin', () => {
  it('writes the origin it is given, and ignores origin keys in the input', async () => {
    const { db, captured } = captureDb();
    const hostile = {
      ...baseInput,
      originKind: 'mcp_client',
      origin_kind: 'mcp_client',
      originClientId: 'evil',
      originClientLabel: 'Hypha',
      origin: { kind: 'hypha_platform' },
      id: 999,
      createdAt: new Date(0),
    } as unknown as CreateCoherenceInput;

    const result = await createCoherence(hostile, {
      db,
      origin: appOrigin(),
    });

    expect(captured.values).toMatchObject({
      originKind: 'app',
      originClientId: null,
      originClientLabel: null,
    });
    expect(captured.values).not.toHaveProperty('id');
    expect(captured.values).not.toHaveProperty('createdAt');
    expect(captured.values).not.toHaveProperty('origin_kind');
    expect(captured.values).not.toHaveProperty('origin');
    expect(result.origin).toEqual({ kind: 'app', clientLabel: null });
  });

  it('keeps source and externalId as before', async () => {
    const { db, captured } = captureDb();
    await createCoherence(
      { ...baseInput, source: 'acaw-contest', externalId: 'ext-1' },
      { db, origin: spaceKeyOrigin({ keyId: 3, source: 'acaw-contest' }) },
    );
    expect(captured.values).toMatchObject({
      source: 'acaw-contest',
      externalId: 'ext-1',
      originKind: 'space_key',
      originClientId: '3',
      originClientLabel: 'acaw-contest',
    });
  });

  it('returns the entity and the origin apart, without the client id', async () => {
    const { db } = captureDb();
    const result = await createCoherence(baseInput, {
      db,
      origin: spaceKeyOrigin({ keyId: 3, source: 'acaw-contest' }),
    });
    expect(result).not.toHaveProperty('originClientId');
    expect(result).not.toHaveProperty('originKind');
    expect(result.origin).toEqual({
      kind: 'space_key',
      clientLabel: 'acaw-contest',
    });
  });

  it('refuses to write without a valid origin', async () => {
    const { db, captured } = captureDb();
    await expect(
      createCoherence(baseInput, { db, origin: undefined as never }),
    ).rejects.toThrow(/origin is required/);
    const forged = {
      kind: 'app',
      clientId: 'x',
      clientLabel: null,
    } as unknown as Origin;
    await expect(
      createCoherence(baseInput, { db, origin: forged }),
    ).rejects.toThrow(/carries no client/);
    expect(captured.values).toBeUndefined();
  });
});
