export type StorageType = 'memory' | 'postgres';

export interface StorageConfig {
  space: StorageType;
  agreement: StorageType;
  member: StorageType;
  comment: StorageType;
}

export interface CoreConfig {
  storage: StorageConfig;
  defaultPageSize?: number;
}
