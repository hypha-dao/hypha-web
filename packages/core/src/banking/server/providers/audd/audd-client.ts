import 'server-only';

/**
 * Barrel for AUDD's Gateway `/customer/*` API client (Flow 1 — identity/KYC). The shared
 * `node:https` transport lives in `audd-transport.ts`; each API call has its own file
 * (`audd-exchange-token.ts`, `audd-create-customer.ts`, `audd-submit-kyc.ts`,
 * `audd-list-customers.ts`). Re-exported from one place so callers (the adapter, tests) don't need
 * to know the internal file layout.
 */
export {
  getAuddClientConfig,
  toAuddIdempotencyKey,
  type AuddClientConfig,
  type AuddApiError,
} from './audd-transport';
export {
  auddExchangeToken,
  type AuddTokenResponse,
} from './audd-exchange-token';
export {
  auddCreateCustomer,
  type AuddCustomerResponse,
  type AuddCreateCustomerBody,
} from './audd-create-customer';
export {
  auddSubmitKyc,
  type AuddKycSubmissionResponse,
} from './audd-submit-kyc';
export {
  auddListCustomers,
  type AuddCustomerListResponse,
} from './audd-list-customers';
