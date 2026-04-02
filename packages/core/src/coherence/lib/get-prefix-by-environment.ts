import { Environment } from '../types';

function assertUnreachable(value: never): never {
  throw new Error(`Unhandled environment value: ${value}`);
}

export function getPrefixByEnvironment(environment: Environment) {
  switch (environment) {
    case Environment.DEVELOPMENT:
      return 'dev';
    case Environment.PREVIEW:
      return 'prev';
    case Environment.PRODUCTION:
      return 'prod';
  }
  return assertUnreachable(environment);
}
