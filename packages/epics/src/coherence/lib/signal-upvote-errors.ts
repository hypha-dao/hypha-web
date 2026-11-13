/** Server rejection when a vote targets an archived signal. */
export function isArchivedSignalVoteError(error: unknown): boolean {
  return error instanceof Error && /archived signal/i.test(error.message);
}
