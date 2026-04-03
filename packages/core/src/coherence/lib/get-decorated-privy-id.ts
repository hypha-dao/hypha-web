import { Environment } from '../types';
import { getPrefixByEnvironment } from './get-prefix-by-environment';

function getDecoratedPrivyId(privyUserId: string, environment: Environment) {
  if (!privyUserId) {
    throw new Error('Missing privyUserId');
  }
  const prefix = getPrefixByEnvironment(environment);
  const sanitizedPrivyUserId = privyUserId
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  const matrixUsername = `${prefix}_privy_${sanitizedPrivyUserId}`;
  if (matrixUsername.length > 255) {
    throw new Error(
      `Decorated Privy ID exceeds Matrix username length limit (${matrixUsername.length} > 255)`,
    );
  }
  return matrixUsername;
}

export { getDecoratedPrivyId };
