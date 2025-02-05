import { NewDocument } from '@hypha-platform/storage-postgres';
import { Repository } from '../../container/types';
import { Document } from './types';

export interface DocumentRepository extends Repository {
  findById(id: number): Promise<Document | null>;
  findBySlug(slug: string): Promise<Document | null>;
  findAll(): Promise<Document[]>;
  create(values: NewDocument): Promise<Document>;
}
