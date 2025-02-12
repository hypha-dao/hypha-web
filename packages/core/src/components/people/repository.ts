import { Repository } from '../../container';
import { PaginatedResponse, PaginationParams } from '../../shared';
import { Person } from './types';

export type ReadManyPeopleConfig = {
  pagination: PaginationParams;
};

export interface PeopleRepository extends Repository {
  readAll(config: ReadManyPeopleConfig): Promise<PaginatedResponse<Person>>;
  readById(id: number): Promise<Person | null>;
  readBySpaceId(
    { spaceId }: { spaceId: number },
    config: ReadManyPeopleConfig,
  ): Promise<PaginatedResponse<Person>>;
  readBySpaceSlug(
    { spaceSlug }: { spaceSlug: string },
    config: ReadManyPeopleConfig,
  ): Promise<PaginatedResponse<Person>>;
  readBySlug({ slug }: { slug: string }): Promise<Person>;
  create(person: Person): Promise<Person>;
  update(person: Person): Promise<Person>;
  delete(id: number): Promise<void>;
}
