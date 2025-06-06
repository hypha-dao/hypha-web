import { SYMBOLS } from '../../_container';
import { PaginatedResponse, PaginationParams } from '../../common';
import { Person } from '../types';
import { PeopleFindAllConfig, PeopleFindBySpaceConfig } from './repository';
import type { PeopleRepository } from './repository';
import { injectable, inject } from 'inversify';

@injectable()
export class PeopleService {
  constructor(
    @inject(SYMBOLS.Repositories.PeopleRepository)
    private repository: PeopleRepository,
  ) {}

  async verifyAuth() {
    return this.repository.verifyAuth();
  }

  async findBySpaceId(
    { spaceId }: { spaceId: number },
    config: PeopleFindBySpaceConfig = {
      pagination: { page: 1, pageSize: 10 },
    },
  ): Promise<PaginatedResponse<Person>> {
    return this.repository.findBySpaceId({ spaceId }, config);
  }

  async findBySpaceSlug(
    { spaceSlug }: { spaceSlug: string },
    config: PeopleFindBySpaceConfig = {
      pagination: { page: 1, pageSize: 10 },
    },
  ): Promise<PaginatedResponse<Person>> {
    return this.repository.findBySpaceSlug({ spaceSlug }, config);
  }

  async findBySlug({ slug }: { slug: string }): Promise<Person | null> {
    return this.repository.findBySlug({ slug });
  }

  async create(person: Person): Promise<Person> {
    return this.repository.create(person);
  }

  async readAll(
    config: PeopleFindAllConfig,
  ): Promise<PaginatedResponse<Person>> {
    return this.repository.findAll(config);
  }

  async update(person: Person): Promise<Person> {
    return this.repository.update(person);
  }

  /**
   * Returns the current user's profile
   * Uses auth.user_id() provided by Neon RLS Authorize to identify the user
   */
  async findMe(): Promise<Person | null> {
    // Use the repository's findMe method which queries based on auth.user_id()
    return this.repository.findMe();
  }

  async findByAddresses(
    addresses: string[],
    config: { pagination: PaginationParams<Person> } = {
      pagination: { page: 1, pageSize: 10 },
    },
  ): Promise<PaginatedResponse<Person>> {
    return this.repository.findByAddresses(addresses, config);
  }
}
