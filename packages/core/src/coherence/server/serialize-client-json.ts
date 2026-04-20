/**
 * Server actions must return JSON-serializable payloads (Postgres `Date` breaks some runtimes).
 */
export function toClientJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
