import { Environment } from '../types';

export function getPrefixByEnvironment(environment: Environment) {
  switch (environment) {
    case Environment.DEVELOPMENT:
      return 'dev';
    case Environment.PREVIEW:
      return 'prev';
    case Environment.PRODUCTION:
      return 'prod';
    default:
      return 'prod';
  }
}
