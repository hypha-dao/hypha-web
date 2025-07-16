import { inject, injectable } from 'inversify';
import { type SpaceRepository } from './repository';
import { CreateSpaceInput, Space, UpdateSpaceInput } from '../types';
import { SpaceNotFoundError } from '../errors';
import { SYMBOLS } from '../../_container/types';

type GetAllProps = {
  search?: string;
};

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

  async getAll(props?: GetAllProps): Promise<Space[]> {
    return this.repository.findAll(props);
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

  async getAllByWeb3SpaceIds(web3SpaceIds: number[]): Promise<Space[]> {
    return this.repository.findAllByWeb3SpaceIds(web3SpaceIds);
  }
}
