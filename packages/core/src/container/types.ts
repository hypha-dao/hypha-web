import { CoreConfig } from '../config/types';

// Base Repository interface
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface Repository {}

export interface Container {
  config: CoreConfig;
  get<T>(token: symbol): T;
  register<T>(token: symbol, value: T): void;
  createScope(): Container;
}
