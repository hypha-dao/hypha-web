export const SPACES_WEB3_SPACE_ID_UNIQUE_INDEX = 'spaces_web3_space_id_unique';

export class Web3SpaceIdConflictError extends Error {
  readonly status = 409 as const;
  readonly code = 'WEB3_SPACE_ID_CONFLICT' as const;
  readonly web3SpaceId: number;

  constructor(web3SpaceId: number) {
    super(`Space with web3SpaceId ${web3SpaceId} already exists`);
    this.name = 'Web3SpaceIdConflictError';
    this.web3SpaceId = web3SpaceId;
  }
}

export function isWeb3SpaceIdConflictError(
  error: unknown,
): error is Web3SpaceIdConflictError {
  if (error instanceof Web3SpaceIdConflictError) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; name?: unknown };
  return (
    candidate.code === 'WEB3_SPACE_ID_CONFLICT' ||
    candidate.name === 'Web3SpaceIdConflictError'
  );
}
