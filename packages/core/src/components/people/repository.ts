import { PaginatedResponse, PaginationParams } from '../../shared';
import { Person } from './types';

export type PeopleFindAllConfig = {
  pagination: PaginationParams<Person>;
};

export type PeopleFindBySpaceConfig = {
  pagination: PaginationParams<Person>;
};

export interface PeopleRepository {
  findAll(config: PeopleFindAllConfig): Promise<PaginatedResponse<Person>>;
  findById(id: number): Promise<Person | null>;
  findBySpaceId(
    { spaceId }: { spaceId: number },
    config: PeopleFindBySpaceConfig,
  ): Promise<PaginatedResponse<Person>>;
  findBySpaceSlug(
    { spaceSlug }: { spaceSlug: string },
    config: PeopleFindBySpaceConfig,
  ): Promise<PaginatedResponse<Person>>;
  findBySlug({ slug }: { slug: string }): Promise<Person>;
  create(person: Person): Promise<Person>;
  update(person: Person): Promise<Person>;
  delete(id: number): Promise<void>;
  verifyAuth(): Promise<boolean>;
  findMe(): Promise<Person | null>;
}
