import { describe, expect, it } from 'vitest';

import { buildCreateSpaceWeb2Input } from '../build-create-space-web2-input';

describe('buildCreateSpaceWeb2Input', () => {
  it('strips File fields and attaches uploaded ecosystem URLs', () => {
    const logo = new File(['x'], 'logo.png', { type: 'image/png' });
    const banner = new File(['y'], 'banner.jpg', { type: 'image/jpeg' });

    const parsed = buildCreateSpaceWeb2Input(
      {
        title: 'LocalScale',
        description: 'A space for local coordination',
        logoUrl: logo,
        leadImage: banner,
        parentId: null,
        categories: [],
        links: [],
        flags: ['sandbox'],
      },
      {
        logoUrl: 'https://bovzk9ehhu.ufs.sh/f/logo',
        leadImage: 'https://bovzk9ehhu.ufs.sh/f/banner',
      },
      { spaceId: 42, executor: '0xabc' },
    );

    expect(parsed.web3SpaceId).toBe(42);
    expect(parsed.address).toBe('0xabc');
    expect(parsed.title).toBe('LocalScale');
    expect(parsed).not.toHaveProperty('logoUrl');
    expect(parsed).not.toHaveProperty('leadImage');
  });
});
