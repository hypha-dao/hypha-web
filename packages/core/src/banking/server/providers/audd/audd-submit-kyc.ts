import 'server-only';

import { auddRequest, type AuddClientConfig } from './audd-transport';

export type AuddKycSubmissionResponse = {
  customerId: string;
  kycStatus: string;
  submittedAt?: string;
  verificationUrl: string;
};

/** `POST /customer/customers/{id}/kyc` — body `{ tierId }` only; `202` carries `verificationUrl`. */
export async function auddSubmitKyc(
  customerId: string,
  body: { tierId: string },
  auth: { accessToken: string; idempotencyKey: string },
  config?: AuddClientConfig,
): Promise<AuddKycSubmissionResponse> {
  return auddRequest<AuddKycSubmissionResponse>({
    method: 'POST',
    path: `/customer/customers/${encodeURIComponent(customerId)}/kyc`,
    body,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Idempotency-Key': auth.idempotencyKey,
    },
    config,
  });
}
