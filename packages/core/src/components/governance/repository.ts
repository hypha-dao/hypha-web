import {
  FilterParams,
  PaginatedResponse,
  PaginationParams,
} from '../../shared';
import { Document } from './types';

export type FindAllBySpaceSlugConfig = {
  pagination: PaginationParams<Document>;
  filter: FilterParams<Document>;
};

export interface DocumentRepository {
  findById(id: number): Promise<Document | null>;
  findBySlug(slug: string): Promise<Document | null>;
  findAll(): Promise<Document[]>;
  findAllBySpaceSlug(
    { spaceSlug }: { spaceSlug: string },
    config: FindAllBySpaceSlugConfig,
  ): Promise<PaginatedResponse<Document>>;
}
