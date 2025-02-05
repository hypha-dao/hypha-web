import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DocumentRepositoryPostgres } from './repository-postgres';
import {
  db,
  documents,
  NewDocument,
  people,
  type Document,
} from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';

describe('DocumentRepositoryPostgres Integration', () => {
  let repository: DocumentRepositoryPostgres;
  let testPersonId: number;
  const testEmail = `test-${Date.now()}@example.com`; // Ensure unique email

  let testDocuments: Document[] = [];

  const createDocument = async (values: NewDocument) => {
    const [document] = await db.insert(documents).values(values).returning();
    testDocuments.push(document);
    return document;
  };

  beforeAll(async () => {
    repository = new DocumentRepositoryPostgres();

    // Create a test person first
    const [person] = await db
      .insert(people)
      .values({
        name: 'Test',
        surname: 'User',
        email: testEmail,
      })
      .returning();

    testPersonId = person.id;

    // Create a test document with all fields
    await createDocument({
      creatorId: testPersonId,
      title: 'Test Document',
      description: 'Test Description',
      slug: 'test-document',
    } as NewDocument);
  });

  afterAll(async () => {
    // Clean up test documents
    testDocuments.forEach(async (document) => {
      await db.delete(documents).where(eq(documents.id, document.id));
    });

    // Clean up test person
    if (testPersonId) {
      await db.delete(people).where(eq(people.id, testPersonId));
    }
  });

  it('should find a document by id', async () => {
    const document = await repository.findById(testDocuments[0].id);

    expect(document).not.toBeNull();
    expect(document?.title).toBe('Test Document');
    expect(document?.description).toBe('Test Description');
    expect(document?.slug).toBe('test-document');
    expect(document?.creatorId).toBe(testPersonId);
  });

  it('should return null when document is not found by id', async () => {
    const nonExistentId = 99999;
    const document = await repository.findById(nonExistentId);

    expect(document).toBeNull();
  });
});
