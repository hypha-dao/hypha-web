import { DatabaseInstance } from '@core/_container';

export type DbConfig = {
  db: DatabaseInstance;
};

export * from './pagination';
export * from './order';
