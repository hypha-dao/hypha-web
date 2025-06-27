export function transformNullToUndefined<T extends object>(data: T): T {
  const entries = Object.entries(data).map(([key, value]) => {
    if (value === null) {
      return [key, undefined];
    } else {
      return [key, value];
    }
  });
  return Object.fromEntries(entries) as T;
}
