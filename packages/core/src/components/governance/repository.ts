import { Repository } from '../../container/types';
import { Document, CreateDocument } from './types';

export interface DocumentRepository extends Repository {
  findById(id: number): Promise<Document | null>;
  findBySlug(slug: string): Promise<Document | null>;
  findAll(): Promise<Document[]>;
  create(values: CreateDocument): Promise<Document>;
}
