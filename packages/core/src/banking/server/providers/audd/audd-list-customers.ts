import 'server-only';

import { auddRequest, type AuddClientConfig } from './audd-transport';
import type { AuddCustomerResponse } from './audd-create-customer';

export type AuddCustomerListResponse = {
  items: AuddCustomerResponse[];
  total: number;
};

/**
 * `GET /customer/customers` — `kycStatus` is **filter-only** (never in the response), so reading
 * one customer's KYC state means probing each candidate value and checking membership.
 */
export async function auddListCustomers(
  params: {
    accessToken: string;
    kycStatus?: string;
    query?: string;
    limit?: number;
    index?: number;
  },
  config?: AuddClientConfig,
): Promise<AuddCustomerListResponse> {
  return auddRequest<AuddCustomerListResponse>({
    method: 'GET',
    path: '/customer/customers',
    query: {
      kycStatus: params.kycStatus,
      query: params.query,
      limit: params.limit,
      index: params.index,
    },
    headers: { Authorization: `Bearer ${params.accessToken}` },
    config,
  });
}
