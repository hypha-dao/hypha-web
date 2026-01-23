import { Environment } from '../types';
import { getPrefixByEnvironment } from './get-prefix-by-environment';

function getDecoratedPrivyId(privyUserId: string, environment: Environment) {
  if (!privyUserId) {
    return '';
  }
  const prefix = getPrefixByEnvironment(environment);
  const matrixUsername = `${prefix}_privy_${privyUserId
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()}`;
  return matrixUsername;
}

export { getDecoratedPrivyId };
