export type BankOnboardingHttpStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 500
  | 502;

/** User-facing fallback when bank account / corridor setup fails unexpectedly. */
export const BANK_SETUP_FAILED_USER_MESSAGE =
  'We could not complete setup. Please try again later. If the problem continues, contact us.';

export class BankOnboardingError extends Error {
  readonly status: BankOnboardingHttpStatus;

  constructor(message: string, status: BankOnboardingHttpStatus) {
    super(message);
    this.name = 'BankOnboardingError';
    this.status = status;
  }
}
