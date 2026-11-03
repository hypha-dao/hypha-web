export type OpenPersonRoomError =
  | 'not-connected'
  | 'no-matrix-id'
  | 'open-failed';

export class OpenPersonRoomFailure extends Error {
  constructor(readonly code: OpenPersonRoomError) {
    super(code);
  }
}

export function noticeKeyForOpenPersonRoomError(
  error: unknown,
): 'matrixUnavailable' | 'matrixPersonUnavailable' | 'matrixFailed' {
  if (error instanceof OpenPersonRoomFailure) {
    if (error.code === 'not-connected') return 'matrixUnavailable';
    if (error.code === 'no-matrix-id') return 'matrixPersonUnavailable';
  }
  return 'matrixFailed';
}
