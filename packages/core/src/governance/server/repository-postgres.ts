import { db as defaultDb } from '@hypha-platform/storage-postgres';
import { Document } from '../types';
import { DocumentRepository, FindAllBySpaceSlugConfig } from './repository';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '@hypha-platform/storage-postgres';
import { Order, PaginatedResponse } from '../../common';
import {
  findAllDocuments,
  findAllDocumentsBySpaceSlug,
  findDocumentById,
  findDocumentBySlug,
  findMostRecentDocuments,
  findAllDocumentsBySpaceSlugWithoutPagination,
} from './queries';
import { FilterParams } from '../../common';

export class DocumentRepositoryPostgres implements DocumentRepository {
  private db: NodePgDatabase<typeof schema>;

  constructor(db: NodePgDatabase<typeof schema> = defaultDb) {
    this.db = db;
  }

  async findById(id: number): Promise<Document | null> {
    return findDocumentById({ id }, { db: this.db });
  }

  async findBySlug(slug: string): Promise<Document | null> {
    return findDocumentBySlug({ slug }, { db: this.db });
  }

  async findAll(): Promise<Document[]> {
    return findAllDocuments({ db: this.db });
  }

  async findAllBySpaceSlug(
    {
      spaceSlug,
    }: {
      spaceSlug: string;
    },
    config: FindAllBySpaceSlugConfig,
  ): Promise<PaginatedResponse<Document>> {
    return findAllDocumentsBySpaceSlug(
      { spaceSlug },
      { ...config, db: this.db },
    );
  }

  async findMostRecent(): Promise<Document | null> {
    return findMostRecentDocuments({ db: this.db });
  }

  async findAllBySpaceSlugWithoutPagination(input: {
    spaceSlug: string;
    filter?: FilterParams<Document>;
    searchTerm?: string;
    order?: Order<Document>;
  }): Promise<Document[]> {
    return findAllDocumentsBySpaceSlugWithoutPagination(input, { db: this.db });
  }
}
