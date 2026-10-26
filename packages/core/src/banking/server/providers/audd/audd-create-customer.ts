import 'server-only';

import { auddRequest, type AuddClientConfig } from './audd-transport';

export type AuddCustomerResponse = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  dateCreated?: string;
  merchantGroupId?: string | null;
  merchantGroupName?: string | null;
  active?: boolean;
  tierId?: string | null;
  tierName?: string | null;
  companyType?: string;
};

export type AuddCreateCustomerBody = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  addressLine1: string;
  suburb: string;
  postcode: string;
  state: string;
  country: string;
  companyType: string;
  middleName?: string;
  addressLine2?: string;
  merchantGroupId?: string;
  registrationNumber?: string;
  companyBusinessName?: string;
};

/** `POST /customer/customers` — `Idempotency-Key` must be exactly 32 chars. */
export async function auddCreateCustomer(
  body: AuddCreateCustomerBody,
  auth: { accessToken: string; idempotencyKey: string },
  config?: AuddClientConfig,
): Promise<AuddCustomerResponse> {
  return auddRequest<AuddCustomerResponse>({
    method: 'POST',
    path: '/customer/customers',
    body,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Idempotency-Key': auth.idempotencyKey,
    },
    config,
  });
}
