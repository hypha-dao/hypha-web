import { StorageType } from '../config/types';
import { Tokens } from './tokens';
import {
  MemorySpaceRepository,
  PostgresSpaceConfigRepository,
  PostgresSpaceRepository,
} from '@hypha-platform/storage-postgres';

// Type for repository constructors
type RepositoryConstructor = new () => any;

// Type for partial implementation map
type ImplementationMap = Partial<Record<StorageType, RepositoryConstructor>>;

// Map storage types to repository implementations
const repositoryMap = new Map<symbol, ImplementationMap>([
  [
    Tokens.SpaceRepository,
    {
      postgres: PostgresSpaceRepository,
      memory: MemorySpaceRepository,
    },
  ],
  [
    Tokens.SpaceConfigRepository,
    {
      postgres: PostgresSpaceConfigRepository,
    },
  ],
  // Add other repositories as they're implemented
  // [Tokens.AgreementRepository, { ... }],
  // [Tokens.MemberRepository, { ... }],
]);

export function getRepositoryImplementation(
  token: symbol,
  storageType: StorageType,
): any {
  const implementations = repositoryMap.get(token);
  if (!implementations) {
    throw new Error(`No implementations found for token: ${token.toString()}`);
  }

  const Implementation = implementations[storageType];
  if (!Implementation) {
    throw new Error(
      `No implementation found for storage type ${storageType} and token ${token.toString()}`,
    );
  }

  return new Implementation();
}
