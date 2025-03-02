import { and, eq, sql } from 'drizzle-orm';
import {
  documents,
  Document as DbDocument,
  db as defaultDb,
  spaces,
} from '@hypha-platform/storage-postgres';
import { Document, DocumentState } from './types';
import { DocumentRepository, FindAllBySpaceSlugConfig } from './repository';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '@hypha-platform/storage-postgres';
import { PaginatedResponse } from '../../shared';

export class DocumentRepositoryPostgres implements DocumentRepository {
  private db: NodePgDatabase<typeof schema>;

  constructor(db: NodePgDatabase<typeof schema> = defaultDb) {
    this.db = db;
  }

  private mapToDocument(dbDocument: DbDocument): Document {
    return {
      id: dbDocument.id,
      creatorId: dbDocument.creatorId,
      title: dbDocument.title ?? '',
      description: dbDocument.description ?? undefined,
      slug: dbDocument.slug ?? '',
      state: dbDocument.state as DocumentState,
      createdAt: dbDocument.createdAt,
      updatedAt: dbDocument.updatedAt,
    };
  }

  async findById(id: number): Promise<Document | null> {
    const result = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    return result[0] ? this.mapToDocument(result[0]) : null;
  }

  async findBySlug(slug: string): Promise<Document | null> {
    const result = await this.db
      .select()
      .from(documents)
      .where(eq(documents.slug, slug))
      .limit(1);

    return result[0] ? this.mapToDocument(result[0]) : null;
  }

  async findAll(): Promise<Document[]> {
    const results = await this.db.select().from(documents);
    return results.map(this.mapToDocument);
  }

  async findAllBySpaceSlug(
    {
      spaceSlug,
    }: {
      spaceSlug: string;
    },
    config: FindAllBySpaceSlugConfig,
  ): Promise<PaginatedResponse<Document>> {
    const {
      pagination: { page = 1, pageSize = 10 },
      filter = {},
    } = config;

    const offset = (page - 1) * pageSize;

    const results = await this.db
      .select({
        document: documents,
        total: sql<number>`cast(count(*) over() as integer)`,
      })
      .from(documents)
      .innerJoin(spaces, eq(documents.spaceId, spaces.id))
      .where(
        and(
          eq(spaces.slug, spaceSlug),
          eq(
            documents.state,
            filter.state as 'discussion' | 'proposal' | 'agreement',
          ),
        ),
      )
      .limit(pageSize)
      .offset(offset);

    const total = results.length > 0 ? results[0].total : 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: results.map((result) => this.mapToDocument(result.document)),
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findMostRecent(): Promise<Document | null> {
    const results = await this.db
      .select()
      .from(documents)
      .orderBy(documents.createdAt)
      .limit(1);

    return results.length > 0 ? this.mapToDocument(results[0]) : null;
  }
}
