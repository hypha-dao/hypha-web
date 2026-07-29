/**
 * Recognise a Postgres unique-constraint violation (SQLSTATE 23505).
 *
 * Any check-then-insert has a window where a concurrent request inserts first,
 * so the constraint — not the check — is what actually guarantees uniqueness.
 * Callers use this to turn the resulting error into the same answer the check
 * would have produced, rather than a 500.
 *
 * Pass `constraint` to narrow to one index when a table has several, so an
 * unrelated violation is not mistaken for the expected one.
 */
export function isUniqueViolation(
  error: unknown,
  constraint?: string,
): boolean {
  const candidate = error as {
    code?: string;
    constraint?: string;
    cause?: unknown;
  } | null;
  if (!candidate || typeof candidate !== 'object') return false;

  if (candidate.code === '23505') {
    return constraint
      ? Boolean(candidate.constraint?.includes(constraint))
      : true;
  }

  // Drizzle wraps driver errors, so the SQLSTATE can sit one level down.
  return candidate.cause
    ? isUniqueViolation(candidate.cause, constraint)
    : false;
}
