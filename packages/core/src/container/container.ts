import { Container } from './types';
import { CoreConfig } from '../config/types';
import { defaultConfig } from '../config/defaults';

export class DefaultContainer implements Container {
  private dependencies = new Map<symbol, any>();

  constructor(public config: CoreConfig = defaultConfig) {
    this.dependencies.set(Symbol('Config'), config);
  }

  get<T>(token: symbol): T {
    const dependency = this.dependencies.get(token);
    if (!dependency) {
      throw new Error(`Dependency not found for token: ${token.toString()}`);
    }
    return dependency;
  }

  register<T>(token: symbol, value: T): void {
    this.dependencies.set(token, value);
  }

  createScope(): Container {
    const scopedContainer = new DefaultContainer(this.config);
    // Copy all dependencies to the new scope
    this.dependencies.forEach((value, key) => {
      scopedContainer.register(key, value);
    });
    return scopedContainer;
  }
}
