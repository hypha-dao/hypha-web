import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DocumentRepositoryPostgres } from './repository-postgres';
import { db, documents, people } from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';

describe('DocumentRepositoryPostgres Integration', () => {
  let repository: DocumentRepositoryPostgres;
  let testDocumentId: number;
  let testPersonId: number;
  const testEmail = `test-${Date.now()}@example.com`; // Ensure unique email

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

    // Create a test document with only required fields
    const [document] = await db
      .insert(documents)
      .values({
        creatorId: testPersonId,
      })
      .returning();

    testDocumentId = document.id;

    // Update with optional fields
    await db
      .update(documents)
      .set({
        title: 'Test Document',
        description: 'Test Description',
        slug: 'test-document',
      } as any)
      .where(eq(documents.id, testDocumentId));
  });

  afterAll(async () => {
    // Clean up only the test data we created
    if (testDocumentId) {
      await db.delete(documents).where(eq(documents.id, testDocumentId));
    }
    if (testPersonId) {
      await db.delete(people).where(eq(people.id, testPersonId));
    }
  });

  it('should find a document by id', async () => {
    const document = await repository.findById(testDocumentId);

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
