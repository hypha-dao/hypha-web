import { eq, sql } from 'drizzle-orm';
import { Document, DocumentState, CreateDocument } from './types';
import { DocumentRepository } from './repository';
import {
  Database,
  documents,
  schema,
  db as defaultDb,
} from '@hypha-platform/storage-postgres';
import { nullToUndefined } from '../../utils';
import invariant from 'tiny-invariant';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class DocumentRepositoryPostgres implements DocumentRepository {
  constructor(
    private db: Database | NodePgDatabase<typeof schema> = defaultDb,
  ) {}

  private fields() {
    return {
      id: documents.id,
      creatorId: documents.creatorId,
      title: documents.title,
      description: documents.description,
      slug: documents.slug,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      state: sql<DocumentState>`
          COALESCE(
            (SELECT dst.to_state
             FROM document_state_transitions dst
             WHERE dst.document_id = ${documents.id}
             ORDER BY dst.created_at DESC
             LIMIT 1),
            'discussion'
          )
        `.as('state'),
    };
  }

  private mapToDocument(row: {
    id: number;
    creatorId: number;
    title: string | null;
    description: string | null;
    slug: string | null;
    createdAt: Date;
    updatedAt: Date;
    state: DocumentState;
  }): Document {
    // TODO: figure out how to type this correctly on db level
    invariant(row.slug, 'slug is required');
    return {
      id: row.id,
      creatorId: row.creatorId,
      title: nullToUndefined(row.title),
      description: nullToUndefined(row.description),
      slug: row.slug,
      state: row.state,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(id: number): Promise<Document | null> {
    const result = await this.db
      .select(this.fields())
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    return result[0] ? this.mapToDocument(result[0]) : null;
  }

  async findBySlug(slug: string): Promise<Document | null> {
    const result = await this.db
      .select(this.fields())
      .from(documents)
      .where(eq(documents.slug, slug))
      .limit(1);

    return result[0] ? this.mapToDocument(result[0]) : null;
  }

  async findAll(): Promise<Document[]> {
    const results = await this.db.select(this.fields()).from(documents);
    return results.map(this.mapToDocument);
  }

  async create(values: CreateDocument): Promise<Document> {
    const [inserted] = await this.db
      .insert(documents)
      .values(values)
      .returning();
    const [result] = await this.db
      .select(this.fields())
      .from(documents)
      .where(eq(documents.id, inserted.id))
      .limit(1);
    return this.mapToDocument(result);
  }
}
