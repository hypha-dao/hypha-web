import { CoreConfig } from '../config/types';

export interface Container {
  config: CoreConfig;
  get<T>(token: symbol): T;
  register<T>(token: symbol, value: T): void;
  createScope(): Container;
}
