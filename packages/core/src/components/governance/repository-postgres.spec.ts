import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentRepositoryPostgres } from './repository-postgres';
import {
  db,
  documents,
  type NewDocument,
  people,
  type Document,
  type Person,
  type NewPerson,
  schema,
} from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { seed, reset } from 'drizzle-seed';
import { Document as DomainDocument, CreateDocument } from './types';

describe('DocumentRepositoryPostgres', () => {
  let repository: DocumentRepositoryPostgres;

  const createPerson = async (values: NewPerson) => {
    const [person] = await db.insert(people).values(values).returning();
    return person;
  };

  const createDocument = async (values: CreateDocument) => {
    const [document] = await db.insert(documents).values(values).returning();
    return document;
  };

  beforeEach(async () => {
    repository = new DocumentRepositoryPostgres();
    await reset(db, schema);
  });

  afterAll(async () => {
    await reset(db, schema);
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

      const slug = `new-document-${Date.now()}`;
      const values: CreateDocument = {
        creatorId: person.id,
        title: 'New Document',
        description: 'New Description',
        slug,
      };
      const newDocument = await repository.create(values);

      expect(newDocument.id).toBeDefined();
      expect(newDocument.title).toBe('New Document');
      expect(newDocument.description).toBe('New Description');
      expect(newDocument.slug).toBe(slug);
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

      const values: CreateDocument = {
        creatorId: person.id,
        // TODO: improve slug type
        slug: `test-document-${Date.now()}`,
      };
      const newDocument = await repository.create(values);

      expect(newDocument.id).toBeDefined();
      expect(newDocument.creatorId).toBe(person.id);
      expect(newDocument.title).toBeUndefined();
      expect(newDocument.description).toBeUndefined();
      expect(newDocument.slug).toBe(values.slug);
    });

    it('should fail if creatorId is missing', async () => {
      await expect(repository.create({} as CreateDocument)).rejects.toThrow();
    });
  });
});
