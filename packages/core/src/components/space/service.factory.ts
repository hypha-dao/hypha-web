import { defaultConfig } from '../../config/defaults';
import { getContainer } from '../../container';
import { SpaceService } from './service';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { schema, db as defaultDb } from '@hypha-platform/storage-postgres';
import { SpacePostgresRepository } from './repository-postgres';
import { Tokens } from '../../container/tokens';
import { SpaceRepository } from './repository';

type CreateSpaceServiceProps = {
  config?: typeof defaultConfig;
  authToken?: string;
};

export const createSpaceService = ({
  config = defaultConfig,
  authToken,
}: CreateSpaceServiceProps = {}) => {
  // Get the container
  const container = getContainer(config);

  // Create a new repository with the authenticated connection if token is provided
  if (authToken) {
    try {
      // Create Neon connection with auth token for RLS
      const sql = neon(process.env.DEFAULT_DB_AUTHENTICATED_URL!, {
        authToken, // This enables RLS with the user's permissions
      });

      // Create drizzle instance with the authenticated connection
      const db = drizzle(sql, { schema });

      // Create a repository with the authenticated connection
      const repository = new SpacePostgresRepository(db);

      // Create and return service with the repository
      return new SpaceService(repository);
    } catch (error) {
      console.error('Failed to create authenticated DB connection:', error);
      // Fall back to standard container approach
    }
  }

  // Default approach - get the repository from the container and create a service
  const repository = container.get(Tokens.SpaceRepository) as SpaceRepository;
  return new SpaceService(repository);
};
