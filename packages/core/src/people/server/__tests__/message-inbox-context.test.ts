import { describe, expect, it } from 'vitest';

import { labelInboxSpaces } from '../message-inbox-labels';

describe('labelInboxSpaces', () => {
  it('names the ecosystem root without listing rooms the member is not in', () => {
    const labeled = labelInboxSpaces(
      [
        {
          id: 1,
          slug: 'hypha',
          title: 'Hypha',
          parentId: null,
          chatRoomId: '!root:hs',
        },
        {
          id: 2,
          slug: 'hypha-platform',
          title: 'Hypha Platform',
          parentId: 1,
          chatRoomId: '!space:hs',
        },
      ],
      new Set([2]),
    );
    expect(labeled).toEqual([
      {
        id: 2,
        slug: 'hypha-platform',
        title: 'Hypha Platform',
        parentId: 1,
        chatRoomId: '!space:hs',
        rootSlug: 'hypha',
        rootTitle: 'Hypha',
      },
    ]);
  });

  it('stops at the last known parent', () => {
    const [space] = labelInboxSpaces([
      {
        id: 4,
        slug: 'circle',
        title: 'Circle',
        parentId: 99,
        chatRoomId: null,
      },
    ]);
    expect(space?.rootSlug).toBe('circle');
    expect(space?.rootTitle).toBe('Circle');
  });
});
