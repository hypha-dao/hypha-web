import { describe, expect, it } from 'vitest';

import { resolveGrantScopes } from '../types';
import { schemaRegisterIntegrationGrant } from '../validation';

describe('resolveGrantScopes', () => {
  const clientScopes = ['agreements:vote'] as const;

  it('defaults to all of the client scopes', () => {
    expect(resolveGrantScopes(clientScopes)).toEqual(['agreements:vote']);
    expect(resolveGrantScopes(clientScopes, [])).toEqual(['agreements:vote']);
  });

  it('accepts a subset and removes duplicates', () => {
    expect(
      resolveGrantScopes(clientScopes, ['agreements:vote', 'agreements:vote']),
    ).toEqual(['agreements:vote']);
  });

  it('refuses a scope the client does not hold', () => {
    expect(resolveGrantScopes([], ['agreements:vote'])).toBeNull();
  });

  it('does not mutate the client scopes', () => {
    const scopes = ['agreements:vote' as const];
    resolveGrantScopes(scopes)?.push('agreements:vote');
    expect(scopes).toEqual(['agreements:vote']);
  });
});

describe('schemaRegisterIntegrationGrant', () => {
  it('allows an empty body (scopes default later)', () => {
    expect(schemaRegisterIntegrationGrant.safeParse({}).success).toBe(true);
  });

  it('rejects unknown scopes and empty scope lists', () => {
    expect(
      schemaRegisterIntegrationGrant.safeParse({ scopes: ['admin'] }).success,
    ).toBe(false);
    expect(
      schemaRegisterIntegrationGrant.safeParse({ scopes: [] }).success,
    ).toBe(false);
  });
});
