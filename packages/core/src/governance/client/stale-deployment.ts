export type StaleAgreementRef = {
  id: number;
  slug: string | null;
};

/**
 * The open tab is calling a Server Action or chunk from a deployment that
 * has been replaced. The action did not run.
 */
export class StaleDeploymentError extends Error {
  readonly code = 'stale-deployment' as const;
  readonly agreement: StaleAgreementRef | null;

  constructor(agreement: StaleAgreementRef | null) {
    super('stale-deployment');
    this.name = 'StaleDeploymentError';
    this.agreement = agreement;
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  return typeof error === 'string' ? error : '';
}

export function isStaleClientBundleError(error: unknown): boolean {
  if (error instanceof StaleDeploymentError) return true;
  const text = errorText(error);
  if (!text) return false;
  return /failed-to-find-server-action|failed to find server action|was not found on the server|older or newer deployment|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Failed to load chunk/i.test(
    text,
  );
}
