import { CoreConfig, getScopedContainer } from '@hypha-platform/core';
import { SpaceService } from '@hypha-platform/core';

const config: CoreConfig = {
  storage: {
    space: 'postgres',
    agreement: 'postgres',
    member: 'postgres',
    comment: 'postgres',
  },
};

export async function readSpaceById(id: number) {
  'use server';

  const container = await getScopedContainer(config);
  const spaceService = new SpaceService(container);

  return spaceService.getById(id);
}

export async function readSpaceBySlug(slug: string) {
  'use server';

  const container = await getScopedContainer(config, slug);
  const spaceService = new SpaceService(container);

  return spaceService.getBySlug(slug);
}
