const DAY_DURATION_IN_SECS: bigint = 86_400n;

export const getDuration = (days: number): bigint => {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error(
      'getDuration expects a non-negative integer number of days',
    );
  }
  return BigInt(days) * DAY_DURATION_IN_SECS;
};
