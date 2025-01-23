import { Container } from '../container/types';
import { StorageType } from '../config/types';

export interface RepositoryFactory {
  create<T>(type: string, storage: StorageType): T;
}

export class DefaultRepositoryFactory implements RepositoryFactory {
  constructor(private container: Container) {}

  create<T>(type: string, storage: StorageType): T {
    // Implementation will be added when storage packages are created
    throw new Error('Not implemented');
  }
}
