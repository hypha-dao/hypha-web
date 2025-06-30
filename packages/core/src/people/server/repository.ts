import { PaginatedResponse, PaginationParams } from '../../common';
import { Person } from '../types';

export type PeopleFindAllConfig = {
  pagination: PaginationParams<Person>;
};

export type PeopleFindBySpaceConfig = {
  pagination: PaginationParams<Person>;
  searchTerm?: string;
};

export interface PeopleRepository {
  findAll(config: PeopleFindAllConfig): Promise<PaginatedResponse<Person>>;
  findById(id: number): Promise<Person | null>;
  findByWeb3Address(address: string): Promise<Person | null>;
  findBySpaceId(
    { spaceId }: { spaceId: number },
    config: PeopleFindBySpaceConfig,
  ): Promise<PaginatedResponse<Person>>;
  findBySpaceSlug(
    { spaceSlug }: { spaceSlug: string },
    config: PeopleFindBySpaceConfig,
  ): Promise<PaginatedResponse<Person>>;
  findBySlug(input: { slug: string }): Promise<Person | null>;
  create(person: Person): Promise<Person>;
  update(person: Person): Promise<Person>;
  delete(id: number): Promise<void>;
  verifyAuth(): Promise<boolean>;
  findMe(): Promise<Person | null>;
  findByAddresses(
    addresses: string[],
    config: { pagination: PaginationParams<Person> },
  ): Promise<PaginatedResponse<Person>>;
}
