import { describe, expect, it } from 'vitest';

import {
  getDhoSpaceSlugFromPathname,
  isDhoSpacePath,
  routeSpaceSlugFromLocation,
} from '../get-dho-space-slug-from-pathname';

describe('getDhoSpaceSlugFromPathname', () => {
  it('extracts slug from proposal create paths', () => {
    expect(
      getDhoSpaceSlugFromPathname(
        '/en/dho/treetop/agreements/create/change-voting-method',
      ),
    ).toBe('treetop');
  });
});

describe('routeSpaceSlugFromLocation', () => {
  it('prefers the DHO pathname over params.id', () => {
    expect(
      routeSpaceSlugFromLocation({
        pathname: '/en/dho/treetop/agreements',
        paramId: 'other',
      }),
    ).toBe('treetop');
  });

  it('ignores a stale params.id on Network and Home', () => {
    expect(
      routeSpaceSlugFromLocation({
        pathname: '/en/network',
        paramId: 'hypha-energy',
      }),
    ).toBe('');
    expect(
      routeSpaceSlugFromLocation({
        pathname: '/en/home',
        paramId: 'hypha-energy',
      }),
    ).toBe('');
    expect(isDhoSpacePath('/en/network')).toBe(false);
  });

  it('allows params.id only while still on a DHO route', () => {
    expect(
      routeSpaceSlugFromLocation({
        pathname: '/en/dho',
        paramId: 'treetop',
      }),
    ).toBe('treetop');
  });
});
