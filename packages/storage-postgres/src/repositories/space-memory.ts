import { Space, SpaceRepository } from '@hypha-platform/model';

export class MemorySpaceRepository implements SpaceRepository {
  async findById(id: number): Promise<Space | null> {
    return {
      id,
      slug: 'mock-space-from-memory',
      title: 'Mock Space from Memory',
      description: 'Mock Space from Memory',
      logoUrl: 'https://example.com/logo.png',
      leadImage: 'https://example.com/lead-image.png',
    };
  }

  async findBySlug(slug: string): Promise<Space | null> {
    return {
      id: 1,
      slug,
      title: 'Mock Space from Memory',
      description: 'Mock Space from Memory',
      logoUrl: 'https://example.com/logo.png',
      leadImage: 'https://example.com/lead-image.png',
    };
  }
}
