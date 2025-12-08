export function canConvertToBigInt(value: any): value is bigint {
  if (typeof value === 'number') {
    // Check if it's an integer
    return Number.isInteger(value);
  }
  if (typeof value === 'string') {
    // Check if it's a string representing an integer
    return /^-?\d+$/.test(value);
  }
  if (typeof value === 'boolean') {
    return true; // Booleans can be converted
  }
  return false; // Other types cannot be directly converted
}
