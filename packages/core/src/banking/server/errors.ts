export type BankOnboardingHttpStatus =
  | 400
  | 401
  | 403
  | 404
  | 422
  | 500;

export class BankOnboardingError extends Error {
  readonly status: BankOnboardingHttpStatus;

  constructor(message: string, status: BankOnboardingHttpStatus) {
    super(message);
    this.name = 'BankOnboardingError';
    this.status = status;
  }
}
