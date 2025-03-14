import { describe, it, expect, beforeEach } from 'vitest';
import { seed, reset } from 'drizzle-seed';

import { people, resetIndexes, schema } from '@hypha-platform/storage-postgres';

import { PeopleRepositoryPostgres } from './repository-postgres';
import { db } from '../../../setup-tests';

describe('PeopleRepositoryPostgres', () => {
  let peopleRepository: PeopleRepositoryPostgres;

  beforeEach(async () => {
    peopleRepository = new PeopleRepositoryPostgres(db);
    await reset(db, schema);
  });

  // Clean up after all tests
  afterAll(async () => {
    await reset(db, schema);
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      await seed(db, { people }).refine((f) => ({
        people: {
          count: 3,
          columns: {
            id: f.int({
              isUnique: true,
            }),
            email: f.valuesFromArray({
              values: ['test@test.com', 'test2@test.com', 'test3@test.com'],
            }),
            slug: f.valuesFromArray({
              values: ['test', 'test2', 'test3'],
            }),
          },
        },
      }));
      await resetIndexes(db);

      // Act: Call findAll with pagination
      const result = await peopleRepository.findAll({
        pagination: { page: 1, pageSize: 2 },
      });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        total: 3,
        page: 1,
        pageSize: 2,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      });

      // Verify the returned data structure
      expect(result.data[0]).toMatchObject({
        name: expect.any(String),
        surname: expect.any(String),
        email: expect.any(String),
        slug: expect.any(String),
        id: expect.any(Number),
      });
    });

    it('should return empty results when no people exist', async () => {
      // Act
      const result = await peopleRepository.findAll({
        pagination: { page: 1, pageSize: 10 },
      });

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.pagination).toEqual({
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });
});
