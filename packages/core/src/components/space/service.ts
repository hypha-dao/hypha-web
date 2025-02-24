import { Container } from '../../container/types';
import { Tokens } from '../../container/tokens';
import { SpaceNotFoundError } from './errors';
import { SpaceRepository } from './repository';
import { Space } from './types';
import { ethers } from 'ethers';

export class SpaceService {
  private repository: SpaceRepository;

  constructor(private container: Container) {
    this.repository = container.get(Tokens.SpaceRepository);
  }

  async getAll(): Promise<Space[]> {
    return this.repository.findAll();
  }

  async getById(id: number): Promise<Space> {
    const space = await this.repository.findById(id);
    if (!space) {
      throw new SpaceNotFoundError(id);
    }
    return space;
  }

  async getBySlug({ slug }: { slug: string }): Promise<Space> {
    const space = await this.repository.findBySlug(slug);
    if (!space) {
      throw new SpaceNotFoundError(slug);
    }
    return space;
  }

  async create(params: {
    title: string;
    description: string;
    slug: string;
    signer: ethers.Signer;
  }): Promise<Space> {
    if ('create' in this.repository) {
      return (this.repository as any).create(params);
    }
    throw new Error('Repository does not support space creation');
  }
}
