import { Space } from './types';
import { SpaceRepository } from './repository';
import { StorageType } from '../../config/types';

export class SpaceInMemoryRepository implements SpaceRepository {
  getStorageType(): StorageType {
    return 'memory';
  }

  async findAll(): Promise<Space[]> {
    throw new Error('Not implemented');
  }

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

  async findAllByMemberId(memberId: number): Promise<Space[]> {
    return [
      {
        id: 1,
        slug: 'mock-space-1',
        title: 'Mock Space 1',
        description: 'Mock Space 1 for member ' + memberId,
        logoUrl: 'https://example.com/logo.png',
        leadImage: 'https://example.com/lead-image.png',
      },
      {
        id: 2,
        slug: 'mock-space-2',
        title: 'Mock Space 2',
        description: 'Mock Space 2 for member ' + memberId,
        logoUrl: 'https://example.com/logo.png',
        leadImage: 'https://example.com/lead-image.png',
      },
    ];
  }
}
