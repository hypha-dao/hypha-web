import { Repository } from '../../container/types';
import { Document, CreateDocument, UpdateDocument } from './types';

export interface DocumentRepository extends Repository {
  readById(id: number): Promise<Document | null>;
  readBySlug(slug: string): Promise<Document | null>;
  // TODO: add optional filter (state)
  readAll(): Promise<Document[]>;
  create(values: CreateDocument): Promise<Document>;
  update(values: UpdateDocument): Promise<Document>;
  // delete(id: number): Promise<void>;
  // publish(id: number): Promise<void>;
  // vote(as: 'yes' | 'no' | 'abstain' ): Promise<void>;
}
