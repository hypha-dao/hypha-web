type BigIntConvertible = bigint | number | string | boolean;

export function canConvertToBigInt(value: unknown): value is BigIntConvertible {
  switch (typeof value) {
    case 'number':
      return Number.isInteger(value);
    case 'string':
      return /^-?\d+$/.test(value.trim());
    case 'boolean':
      return true;
  }
  return false;
}
