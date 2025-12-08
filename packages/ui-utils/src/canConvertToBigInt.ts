export function canConvertToBigInt(value: any): value is bigint {
  if (typeof value === 'number') {
    return Number.isInteger(value);
  }
  if (typeof value === 'string') {
    return /^-?\d+$/.test(value);
  }
  if (typeof value === 'boolean') {
    return true;
  }
  return false;
}
