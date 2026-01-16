function getDecoratedPrivyId(privyUserId: string) {
  if (!privyUserId) {
    return '';
  }
  const matrixUsername = `privy_${privyUserId
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()}`;
  return matrixUsername;
}

export { getDecoratedPrivyId };
