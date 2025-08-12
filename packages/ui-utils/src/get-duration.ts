export const getDuration = (days: number): bigint => {
  return BigInt(days * 86400);
};
