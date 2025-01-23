import { Space, SpaceRepository } from '@hypha-platform/model';
import { Container } from '../../container/types';
import { Tokens } from '../../container/tokens';
import { SpaceNotFoundError } from './errors';

export class SpaceService {
  private repository: SpaceRepository;

  constructor(private container: Container) {
    this.repository = container.get(Tokens.SpaceRepository);
  }

  async getById(id: number): Promise<Space> {
    const space = await this.repository.findById(id);
    if (!space) {
      throw new SpaceNotFoundError(id);
    }
    return space;
  }

  async getBySlug(slug: string): Promise<Space> {
    const space = await this.repository.findBySlug(slug);
    if (!space) {
      throw new SpaceNotFoundError(slug);
    }
    return space;
  }
}
