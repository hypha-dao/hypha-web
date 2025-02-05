import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
import { faker } from '@faker-js/faker';

describe('DocumentRepositoryPostgres', () => {
  let repository: DocumentRepositoryPostgres;
  let testDocuments: Document[] = [];
  let testPeople: Person[] = [];

  const createPerson = async (values: NewPerson) => {
    const [person] = await db.insert(people).values(values).returning();
    testPeople.push(person);
    return person;
  };

  const createDocument = async (
    values: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    const [document] = await db.insert(documents).values(values).returning();
    testDocuments.push(document);
    return document;
  };

  beforeEach(() => {
    repository = new DocumentRepositoryPostgres();
  });

  afterEach(async () => {
    // Clean up test documents first (they reference people)
    for (const document of testDocuments) {
      await db.delete(documents).where(eq(documents.id, document.id));
    }
    testDocuments = [];

    // Then clean up test people
    for (const person of testPeople) {
      await db.delete(people).where(eq(people.id, person.id));
    }
    testPeople = [];
  });

  describe('findById', () => {
    it('should find a document by id', async () => {
      const person = await createPerson({
        name: faker.person.firstName(),
        surname: faker.person.lastName(),
        email: faker.internet.email(),
      });

      const document = await createDocument({
        creatorId: person.id,
        title: 'Test Document',
        description: 'Test Description',
        slug: `test-document-${Date.now()}`,
      });

      const found = await repository.findById(document.id);
      expect(found).not.toBeNull();
      expect(found?.title).toBe('Test Document');
      expect(found?.description).toBe('Test Description');
      expect(found?.slug).toBe(document.slug);
      expect(found?.creatorId).toBe(person.id);
    });

    it('should return null when document is not found by id', async () => {
      const nonExistentId = 99999;
      const document = await repository.findById(nonExistentId);

      expect(document).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('should find a document by slug', async () => {
      const person = await createPerson({
        name: faker.person.firstName(),
        surname: faker.person.lastName(),
        email: faker.internet.email(),
      });

      const slug = `test-document-${Date.now()}`;
      const document = await createDocument({
        creatorId: person.id,
        title: 'Test Document',
        description: 'Test Description',
        slug,
      });

      const found = await repository.findBySlug(slug);

      expect(found).not.toBeNull();
      expect(found?.title).toBe('Test Document');
      expect(found?.description).toBe('Test Description');
      expect(found?.id).toBe(document.id);
      expect(found?.creatorId).toBe(person.id);
    });

    it('should return null when document is not found by slug', async () => {
      const document = await repository.findBySlug('non-existent-document');

      expect(document).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a document with all fields', async () => {
      const person = await createPerson({
        name: faker.person.firstName(),
        surname: faker.person.lastName(),
        email: faker.internet.email(),
      });

      const newDocument = await repository.create({
        creatorId: person.id,
        title: 'New Document',
        description: 'New Description',
        slug: `new-document-${Date.now()}`,
      } as NewDocument);
      testDocuments.push(newDocument);

      expect(newDocument.id).toBeDefined();
      expect(newDocument.title).toBe('New Document');
      expect(newDocument.description).toBe('New Description');
      expect(newDocument.slug).toBe(newDocument.slug);
      expect(newDocument.creatorId).toBe(person.id);

      // Verify we can find the created document
      const found = await repository.findById(newDocument.id);
      expect(found).toEqual(newDocument);
    });

    it('should create a document with only required fields', async () => {
      const person = await createPerson({
        name: faker.person.firstName(),
        surname: faker.person.lastName(),
        email: faker.internet.email(),
      });

      const newDocument = await repository.create({
        creatorId: person.id,
      } as NewDocument);

      testDocuments.push(newDocument);

      expect(newDocument.id).toBeDefined();
      expect(newDocument.creatorId).toBe(person.id);
      expect(newDocument.title).toBeNull();
      expect(newDocument.description).toBeNull();
      expect(newDocument.slug).toBeNull();
    });

    it('should fail if creatorId is missing', async () => {
      await expect(repository.create({} as NewDocument)).rejects.toThrow();
    });
  });
});
