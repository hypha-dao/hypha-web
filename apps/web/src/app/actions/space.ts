import {
  CoreConfig,
  CreateSpaceInput,
  getScopedContainer,
  UpdateSpaceInput,
} from '@hypha-platform/core';
import { SpaceService } from '@hypha-platform/core';

const config: CoreConfig = {
  storage: {
    space: 'postgres',
    agreement: 'postgres',
    member: 'postgres',
    comment: 'postgres',
  },
};

export async function createSpace(input: CreateSpaceInput) {
  'use server';

  const container = await getScopedContainer(config);
  const spaceService = new SpaceService(container);

  return spaceService.create(input);
}

export async function readSpaceById(id: string) {
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

export async function updateSpace(id: string, input: UpdateSpaceInput) {
  'use server';

  const container = await getScopedContainer(config);
  const spaceService = new SpaceService(container);

  return spaceService.update(id, input);
}
