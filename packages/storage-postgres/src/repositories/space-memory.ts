import { Space, SpaceRepository } from '@hypha-platform/model';

export class MemorySpaceRepository implements SpaceRepository {
  async findById(id: string): Promise<Space | null> {
    return {
      id,
      slug: 'test',
      title: 'Test',
      description: 'Test',
      logoUrl: 'https://example.com/logo.png',
      leadImage: 'https://example.com/lead-image.png',
    };
  }

  async findBySlug(slug: string): Promise<Space | null> {
    return {
      id: '1',
      slug,
      title: 'Test',
      description: 'Test',
      logoUrl: 'https://example.com/logo.png',
      leadImage: 'https://example.com/lead-image.png',
    };
  }
}
