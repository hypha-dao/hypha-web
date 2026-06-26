import { describe, expect, it } from 'vitest';

import { getDhoSpaceSlugFromPathname } from '../get-dho-space-slug-from-pathname';

describe('getDhoSpaceSlugFromPathname', () => {
  it('extracts slug from proposal create paths', () => {
    expect(
      getDhoSpaceSlugFromPathname(
        '/en/dho/treetop/agreements/create/change-voting-method',
      ),
    ).toBe('treetop');
  });
});
