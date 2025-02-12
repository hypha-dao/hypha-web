import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentRepositoryPostgres } from './repository-postgres';
import { documents, people } from '@hypha-platform/storage-postgres';
import { seed } from 'drizzle-seed';
import { CreateDocument } from './types';
import { db } from '../../test-utils/setup';
import invariant from 'tiny-invariant';

describe('DocumentRepositoryPostgres', () => {
  let documentRepository: DocumentRepositoryPostgres;

  beforeEach(async () => {
    documentRepository = new DocumentRepositoryPostgres(db);
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

      invariant(document, 'document should be defined');
      invariant(person, 'person should be defined');

      const found = await documentRepository.readById(document.id);
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

      await expect(documentRepository.readById(nonExistentId)).rejects.toThrow(
        `Document with id ${nonExistentId} not found`,
      );
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

      invariant(document, 'document should be defined');
      invariant(person, 'person should be defined');

      const found = await documentRepository.readBySlug(
        document.slug as string,
      );

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
      const document = await documentRepository.readBySlug(
        'non-existent-document',
      );

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
        creatorId: person?.id as number,
        title: 'New Document',
        description: 'New Description',
        slug,
      };
      const newDocument = await documentRepository.create(values);

      expect(newDocument.id).toBeDefined();
      expect(newDocument.title).toBe(values.title);
      expect(newDocument.description).toBe(values.description);
      expect(newDocument.slug).toBe(values.slug);
      expect(newDocument.creatorId).toBe(person?.id);

      // Verify we can find the created document
      const found = await documentRepository.readById(newDocument.id);
      expect(found).toEqual(newDocument);
    });

    it('should create a document with only required fields', async () => {
      await seed(db, { people }).refine((f) => ({
        people: { count: 1 },
      }));

      const person = await db.query.people.findFirst();

      const values: CreateDocument = {
        creatorId: person?.id as number,
        // TODO: improve slug type
        slug: `test-document-${Date.now()}`,
      };
      const newDocument = await documentRepository.create(values);

      expect(newDocument.id).toBeDefined();
      expect(newDocument.creatorId).toBe(person?.id);
      expect(newDocument.title).toBeUndefined();
      expect(newDocument.description).toBeUndefined();
      expect(newDocument.slug).toBe(values.slug);
    });

    it('should fail if creatorId is missing', async () => {
      await expect(
        documentRepository.create({} as CreateDocument),
      ).rejects.toThrow();
    });
  });

  describe('update', async () => {
    it('should update document', async () => {
      await seed(db, { people, documents }).refine(() => ({
        people: { count: 1, with: { documents: 1 } },
      }));
      const [document] = await documentRepository.readAll();
      const newTitle = 'My Test Title';

      const updated = await documentRepository.update({
        id: document.id,
        title: newTitle,
      });

      expect(updated?.title).toBe(newTitle);
    });
  });
});
