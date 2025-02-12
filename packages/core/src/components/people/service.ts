import { PeopleRepository, ReadManyPeopleConfig } from './repository';
import { Container } from '../../container/types';
import { Tokens } from '../../container/tokens';
import { Person } from './types';
import { PaginatedResponse } from '../../shared';

export class PeopleService {
  private repository: PeopleRepository;

  constructor(private container: Container) {
    this.repository = container.get(Tokens.PeopleRepository);
  }

  async findBySpaceId(
    { spaceId }: { spaceId: number },
    config: ReadManyPeopleConfig = {
      pagination: { page: 1, pageSize: 10 },
    },
  ): Promise<PaginatedResponse<Person>> {
    return this.repository.readBySpaceId({ spaceId }, config);
  }

  async findBySpaceSlug(
    { spaceSlug }: { spaceSlug: string },
    config: ReadManyPeopleConfig,
  ): Promise<PaginatedResponse<Person>> {
    return this.repository.readBySpaceSlug({ spaceSlug }, config);
  }

  async findBySlug({ slug }: { slug: string }): Promise<Person> {
    return this.repository.readBySlug({ slug });
  }

  async create(person: Person): Promise<Person> {
    return this.repository.create(person);
  }

  async readAll(
    config: ReadManyPeopleConfig,
  ): Promise<PaginatedResponse<Person>> {
    return this.repository.readAll(config);
  }

  async update(person: Person): Promise<Person> {
    return this.repository.update(person);
  }
}
