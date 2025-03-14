import { inject, injectable } from 'inversify';
import { type SpaceRepository } from './repository';
import { CreateSpaceInput, Space, UpdateSpaceInput } from './types';
import { SpaceNotFoundError } from './errors';
import { SYMBOLS } from '../../container/types';

@injectable()
export class SpaceService {
  constructor(
    @inject(SYMBOLS.Repositories.SpaceRepository)
    private repository: SpaceRepository,
  ) {}

  async create(data: CreateSpaceInput): Promise<Space> {
    return this.repository.create(data);
  }

  async updateBySlug(
    data: { slug: string } & UpdateSpaceInput,
  ): Promise<Space> {
    return this.repository.updateBySlug(data);
  }

  async getAll(): Promise<Space[]> {
    return this.repository.findAll();
  }

  async getById(id: number): Promise<Space> {
    const space = await this.repository.findById(id);
    if (!space) {
      throw new SpaceNotFoundError(`Space with id ${id} not found`);
    }
    return space;
  }

  async getAllByMemberId(memberId: number): Promise<Space[]> {
    return this.repository.findAllByMemberId(memberId);
  }

  async getBySlug({ slug }: { slug: string }): Promise<Space> {
    const space = await this.repository.findBySlug(slug);
    if (!space) {
      throw new SpaceNotFoundError(`Space with slug ${slug} not found`);
    }
    return space;
  }
}
