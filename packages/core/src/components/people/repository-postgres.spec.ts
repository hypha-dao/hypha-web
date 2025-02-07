import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  db,
  people,
  resetIndexes,
  schema,
} from '@hypha-platform/storage-postgres';
import { seed, reset } from 'drizzle-seed';

import { PeopleRepositoryPostgres } from './repository-postgres';

describe('PeopleRepositoryPostgres', () => {
  const peopleRepository = new PeopleRepositoryPostgres(db);

  beforeEach(async () => {
    await reset(db, schema);
  });

  // Clean up after all tests
  afterEach(async () => {});

  describe('findAll', () => {
    it('should return paginated results', async () => {
      await seed(db, {
        people,
      }).refine((f) => {
        return {
          people: {
            count: 3,
          },
        };
      });
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
