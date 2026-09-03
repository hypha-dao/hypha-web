import { describe, expect, it } from 'vitest';

import { validateParams } from '../validate-params';
import type { StandardSchemaV1 } from '../types';
import { passthroughSchema, requiresSpaceSlugSchema } from './helpers';

describe('validateParams', () => {
  it('returns the parsed value on success', () => {
    const result = validateParams(requiresSpaceSlugSchema(), {
      spaceSlug: 'hypha',
    });
    expect(result).toEqual({ ok: true, value: { spaceSlug: 'hypha' } });
  });

  it('collects issue messages on failure', () => {
    const result = validateParams(requiresSpaceSlugSchema(), {});
    expect(result).toEqual({ ok: false, issues: ['spaceSlug is required'] });
  });

  it('treats a thrown schema as a failure', () => {
    const throwing: StandardSchemaV1 = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => {
          throw new Error('boom');
        },
      },
    };
    expect(validateParams(throwing, {})).toEqual({
      ok: false,
      issues: ['boom'],
    });
  });

  it('rejects async schemas rather than awaiting them', () => {
    const asyncSchema: StandardSchemaV1 = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: async () => ({ value: {} }),
      },
    };
    const result = validateParams(asyncSchema, {});
    expect(result.ok).toBe(false);
  });

  it('passes arbitrary records through a passthrough schema', () => {
    expect(validateParams(passthroughSchema(), { a: 1 })).toEqual({
      ok: true,
      value: { a: 1 },
    });
  });
});
