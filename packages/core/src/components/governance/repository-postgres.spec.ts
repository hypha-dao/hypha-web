import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentRepositoryPostgres } from './repository-postgres';
import { documents, people } from '@hypha-platform/storage-postgres';
import { seed } from 'drizzle-seed';
import { CreateDocument } from './types';
import { db } from '../../test-utils/setup';

describe('DocumentRepositoryPostgres', () => {
  let repository: DocumentRepositoryPostgres;

  beforeEach(async () => {
    repository = new DocumentRepositoryPostgres(db);
  });

  describe('findById', () => {
    it('should find a document by id', async () => {
      await seed(db, { people, documents }).refine((f) => ({
        people: {
          count: 1,
          with: { documents: 1 },
          columns: {
            id: f.int({
              minValue: 1,
              maxValue: 3,
              isUnique: true,
            }),
          },
        },
      }));

      const document = await db.query.documents.findFirst();
      const person = await db.query.people.findFirst();

      const found = await repository.findById(document.id as number);
      expect(found).not.toBeNull();

      expect(found).toMatchObject({
        title: expect.any(String),
        description: expect.any(String),
        slug: expect.any(String),
        id: expect.any(Number),
        creatorId: person.id,
      });
    });

    it('should return null when document is not found by id', async () => {
      const nonExistentId = 99999;
      const document = await repository.findById(nonExistentId);

      expect(document).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('should find a document by slug', async () => {
      await seed(db, { people, documents }).refine((f) => ({
        people: { count: 1, with: { documents: 1 } },
        documents: {
          count: 1,
          columns: { slug: f.string({ isUnique: true }) },
        },
      }));

      const document = await db.query.documents.findFirst();
      const person = await db.query.people.findFirst();

      const found = await repository.findBySlug(document.slug as string);

      expect(found).not.toBeNull();
      expect(found).toMatchObject({
        title: expect.any(String),
        description: expect.any(String),
        slug: expect.any(String),
        id: expect.any(Number),
        creatorId: person.id,
      });
    });

    it('should return null when document is not found by slug', async () => {
      const document = await repository.findBySlug('non-existent-document');

      expect(document).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a document with all fields', async () => {
      await seed(db, { people }).refine((f) => ({
        people: { count: 1 },
      }));

      const person = await db.query.people.findFirst();

      const slug = `new-document-${Date.now()}`;
      const values: CreateDocument = {
        creatorId: person.id as number,
        title: 'New Document',
        description: 'New Description',
        slug,
      };
      const newDocument = await repository.create(values);

      expect(newDocument.id).toBeDefined();
      expect(newDocument.title).toBe(values.title);
      expect(newDocument.description).toBe(values.description);
      expect(newDocument.slug).toBe(values.slug);
      expect(newDocument.creatorId).toBe(person.id);

      // Verify we can find the created document
      const found = await repository.findById(newDocument.id);
      expect(found).toEqual(newDocument);
    });

    it('should create a document with only required fields', async () => {
      await seed(db, { people }).refine((f) => ({
        people: { count: 1 },
      }));

      const person = await db.query.people.findFirst();

      const values: CreateDocument = {
        creatorId: person.id as number,
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
