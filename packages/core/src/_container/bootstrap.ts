/**
 * Container bootstrapping module.
 * This initializes the InversifyJS container with all necessary bindings.
 */

import { container } from './inversify.config';
import { SYMBOLS } from './types';
import { db as defaultDb } from '@hypha-platform/storage-postgres';
import { SpaceService } from '../space/server/service';
import { DocumentService } from '../governance/server/service';
import { SpacePostgresRepository } from '../space/server/repository-postgres';
import { DocumentRepositoryPostgres } from '../governance/server/repository-postgres';
import { DatabaseProvider } from './database-provider';
import { PeopleRepositoryPostgres } from '../people/server';
import { PeopleService } from '../people/server/service';

/**
 * Initialize the container with all required dependencies.
 * This should be called at application startup.
 */
export function initializeContainer(): void {
  // Register database connections
  container.bind(SYMBOLS.Database.AdminConnection).toConstantValue(defaultDb);

  container.bind(DatabaseProvider).toSelf().inSingletonScope();

  // Register repositories with their symbols
  container
    .bind(SYMBOLS.Repositories.PeopleRepository)
    .to(PeopleRepositoryPostgres)
    .inSingletonScope();
  container
    .bind(SYMBOLS.Repositories.SpaceRepository)
    .to(SpacePostgresRepository)
    .inSingletonScope();
  container
    .bind(SYMBOLS.Repositories.DocumentRepository)
    .to(DocumentRepositoryPostgres)
    .inSingletonScope();

  // Register services by their class type
  container.bind(PeopleService).toSelf().inTransientScope();
  container.bind(SpaceService).toSelf().inTransientScope();
  container.bind(DocumentService).toSelf().inTransientScope();
}
