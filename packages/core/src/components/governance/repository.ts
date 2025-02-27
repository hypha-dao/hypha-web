import { Repository } from '../../container/types';
import { FilterParams, PaginationParams } from '../../shared';
import { Document, CreateDocument, UpdateDocument } from './types';

export interface ReadManyDocumentConfig {
  pagination?: PaginationParams;
  filter?: FilterParams<Document>;
}

export interface DocumentRepository extends Repository {
  readById(id: number): Promise<Document | null>;
  readBySlug(slug: string): Promise<Document | null>;
  // TODO: add optional filter (state)
  readAll(config: ReadManyDocumentConfig): Promise<Document[]>;
  readAllBySpaceSlug(
    { spaceSlug }: { spaceSlug: string },
    config?: ReadManyDocumentConfig,
  ): Promise<Document[]>;
  create(values: CreateDocument): Promise<Document>;
  update(values: UpdateDocument): Promise<Document>;
  // delete(id: number): Promise<void>;
  // publish(id: number): Promise<void>;
  // vote(as: 'yes' | 'no' | 'abstain' ): Promise<void>;
}
