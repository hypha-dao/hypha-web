import { getDhoSpaceContextPath } from './get-dho-space-context-path';

describe('getDhoSpaceContextPath', () => {
  it('preserves the active tab when switching spaces', () => {
    expect(
      getDhoSpaceContextPath({
        pathname: '/en/dho/current-space/coherence/new-signal',
        lang: 'en',
        spaceSlug: 'next-space',
      }),
    ).toBe('/en/dho/next-space/coherence');
  });

  it('preserves supported tabs beyond agreements', () => {
    expect(
      getDhoSpaceContextPath({
        pathname: '/en/dho/current-space/members',
        lang: 'en',
        spaceSlug: 'next-space',
      }),
    ).toBe('/en/dho/next-space/members');
  });

  it('falls back to agreements for non-tab overlay routes', () => {
    expect(
      getDhoSpaceContextPath({
        pathname: '/en/dho/current-space/space/create',
        lang: 'en',
        spaceSlug: 'next-space',
      }),
    ).toBe('/en/dho/next-space/agreements');
  });

  it('preserves null and undefined pathnames', () => {
    expect(
      getDhoSpaceContextPath({
        pathname: null,
        lang: 'en',
        spaceSlug: 'next-space',
      }),
    ).toBeNull();
    expect(
      getDhoSpaceContextPath({
        pathname: undefined,
        lang: 'en',
        spaceSlug: 'next-space',
      }),
    ).toBeUndefined();
  });

  it('returns non-DHO paths unchanged', () => {
    expect(
      getDhoSpaceContextPath({
        pathname: '/en/other/path',
        lang: 'en',
        spaceSlug: 'next-space',
      }),
    ).toBe('/en/other/path');
  });
});
