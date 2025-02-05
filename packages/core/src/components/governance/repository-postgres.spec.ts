import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DocumentRepositoryPostgres } from './repository-postgres';
import {
  db,
  documents,
  NewDocument,
  people,
  type Document,
  type Person,
  type NewPerson,
} from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';

describe('DocumentRepositoryPostgres', () => {
  let repository: DocumentRepositoryPostgres;
  const testEmail = `test-${Date.now()}@example.com`; // Ensure unique email

  let testDocuments: Document[] = [];
  let testPeople: Person[] = [];

  const createPerson = async (values: NewPerson) => {
    const [person] = await db.insert(people).values(values).returning();
    testPeople.push(person);
    return person;
  };

  const createDocument = async (values: NewDocument) => {
    const [document] = await db.insert(documents).values(values).returning();
    testDocuments.push(document);
    return document;
  };

  beforeAll(async () => {
    repository = new DocumentRepositoryPostgres();

    // Create a test person
    const person = await createPerson({
      name: 'Test',
      surname: 'User',
      email: testEmail,
    });

    // Create a test document with all fields
    await createDocument({
      creatorId: person.id,
      title: 'Test Document',
      description: 'Test Description',
      slug: 'test-document',
    } as NewDocument);
  });

  afterAll(async () => {
    // Clean up test documents
    for (const document of testDocuments) {
      await db.delete(documents).where(eq(documents.id, document.id));
    }
    testDocuments = [];

    // Clean up test people
    for (const person of testPeople) {
      await db.delete(people).where(eq(people.id, person.id));
    }
    testPeople = [];
  });

  describe('findById', () => {
    it('should find a document by id', async () => {
      const document = await repository.findById(testDocuments[0].id);

      expect(document).not.toBeNull();
      expect(document?.title).toBe('Test Document');
      expect(document?.description).toBe('Test Description');
      expect(document?.slug).toBe('test-document');
      expect(document?.creatorId).toBe(testPeople[0].id);
    });

    it('should return null when document is not found by id', async () => {
      const nonExistentId = 99999;
      const document = await repository.findById(nonExistentId);

      expect(document).toBeNull();
    });
  });
});
