import { getPrefixByEnvironment } from './get-prefix-by-environment';

function getDecoratedPrivyId(privyUserId: string, environment: string) {
  if (!privyUserId) {
    return '';
  }
  const prefix = getPrefixByEnvironment(environment || 'production');
  const matrixUsername = `${prefix}_privy_${privyUserId
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()}`;
  return matrixUsername;
}

export { getDecoratedPrivyId };
